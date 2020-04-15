import { Injectable } from '@angular/core';
import * as Constants from '../../data/constants';
import { Storage } from '@ionic/storage';
import { DatabaseService } from '../../service/database-service';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import * as moment from 'moment';


/*
  Generated class for the ScoreSenderProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class APIProvider {

    constructor(
        private database:DatabaseService,
        private storage: Storage,
        private httpClient: HttpClient
    ) {
        console.log('Hello ScoreSenderProvider Provider');
    }

    async sendPendingScoresToServer(){
        const scores = await this.database.getScores();
        const pendingScores = [];
        scores.forEach(score => {
            if(score.status === 'PENDING'){
                if(score.hour === 24 ) score.hour = 0;
                pendingScores.push(score);
            }
        });
        const user = await this.storage.get('linkedUser');
        const phone_id = user ? user.codigo_app : user;
        const date = moment().format('YYYY-MM-DD hh:mm:ss');
        await this.sendPostRequest(pendingScores, phone_id, date);
    }

    async sendPostRequest(pendingScores: any[], phone_id: string | number, datetime: string){
        console.log('Sending cores');
        const data = this.generateUpdateScoreBody(pendingScores, phone_id, datetime);
        const httpOptions = {
            headers: new HttpHeaders({ 'Content-Type': 'application/json' })
        };

        this.httpClient.post(Constants.UPDATE_REGISTRY_URL, data, httpOptions)
        .toPromise().then(response => {
            pendingScores.forEach(score => {
                this.database.updateScoreStatus(score.id, 'SENT').catch(error => {
                    console.log('ERROR UPDATE SCORE', error);
                });
            });
        }).catch(error => {
            console.log("Error when updating", error);
            //TODO check if the register hasn't been created. If it hasn't, create it and send the method again
            //TODO if the error isn't about register, pass
            const data = this.generateInsertScoreBody(phone_id, datetime);
            this.httpClient.post(Constants.CREATE_REGISTRY_URL, data, httpOptions)
            .toPromise().then(response => {
                console.log('SUCCESS CREATE', response);
            }).catch(error => {
                console.log('error when creating scores', error);
            });
        });
    }

    //NO DEJA ENTRAR A LA APP SI EL CÓDIGO INGRESADO NO ESTÁ EN USO (NO HA SIDO ASIGNADO A UNA PERSONA) O SI EL CÓDIGO INGRESADO NO EXISTE
    validateAppCode(app_code: string) {
        return new Promise<any>((resolve, reject) => {
            const httpOptions = {
                headers: new HttpHeaders({ 'Content-Type':'application/json','Authorization':'491c5713-dd3e-4dda-adda-e36a95d7af77'  })
            };
            const data = this.generateValidationCodeBody(app_code);
            console.log("ENTRO A VALIDAR");
            this.httpClient.post(Constants.READ_REGISTRY_URL, data, httpOptions)
            .toPromise().then(response => {
                if(response['data'].length > 0) {
                    console.log('SUCCESS READ', response['data'][0].en_uso);
                    resolve(response['data'][0].en_uso);
                } else {
                    resolve(0);
                }
            }).catch(error => reject(
                resolve(-1)
            ));
        });
    }

    generateValidationCodeBody(app_code: string) {
        const data = {
            "tabla": "integracion_claves_app",
            "operador": "and",
            "columnas": [
                "app_id", "en_uso"
            ],
            "condiciones": [
                {
                    "columna": "app_id",
                    "comparador": "==",
                    "valor": app_code
                }
            ]
        }
        return JSON.stringify(data);
    }

    validateUser(app_code: string) {
        return new Promise<any>((resolve, reject) => {
            const httpOptions = {
                headers: new HttpHeaders({ 'Content-Type':'application/json','Authorization':'491c5713-dd3e-4dda-adda-e36a95d7af77'  })
            };
            const data = this.generateValidationUserBody(app_code);
            console.log("ENTRO A VALIDAR USUARIO");
            this.httpClient.post(Constants.READ_REGISTRY_URL, data, httpOptions)
            .toPromise().then(response => {
                if(response['data'].length > 0) {
                    console.log('SUCCESS READ');
                    resolve(1);
                } else {
                    resolve(0);
                }
            }).catch(error => reject(
                resolve(-1)
            ));
        });
    }

    generateValidationUserBody(app_code: string) {
        const data = {
            "tabla": "integracion_usuario",
            "operador": "and",
            "columnas": [
                "telefono_id"
            ],
            "condiciones": [
                {
                    "columna": "telefono_id",
                    "comparador": "==",
                    "valor": app_code
                }
            ]
        }
        return JSON.stringify(data);
    }

    createUser(app_code: string) {
        return new Promise<any>((resolve, reject) => {
            const httpOptions = {
                headers: new HttpHeaders({ 'Content-Type':'application/json','Authorization':'491c5713-dd3e-4dda-adda-e36a95d7af77'  })
            };
            const data = this.generateUserCreationBody(app_code);
            console.log("ENTRO A VALIDAR");
            this.httpClient.post(Constants.CREATE_REGISTRY_URL, data, httpOptions)
            .toPromise().then(response => {
                if(response['success']) {
                    console.log('SE CREÓ EL USUARIO CORRECTAMENTE EN LA TABLA');
                    resolve(1);
                } else {
                    resolve(0);
                }
            }).catch(error => reject(
                resolve(-1)
            ));
        });
    }

    generateUserCreationBody(app_code: string) {
        const data = {
            "tabla": "integracion_usuario",
            "datos": [
                {
                    "telefono_id": app_code
                }
            ]
        }
        return JSON.stringify(data);
    }

    updateUser(app_code: string, campo: string, valor: string | number) {
        return new Promise<any>((resolve, reject) => {
            const httpOptions = {
                headers: new HttpHeaders({ 'Content-Type':'application/json','Authorization':'491c5713-dd3e-4dda-adda-e36a95d7af77'  })
            };
            const data = this.generateUpdateUSerBody(app_code, campo, valor);
            console.log("ENTRO A MODIFICAR USUARIO");
            this.httpClient.post(Constants.UPDATE_REGISTRY_URL, data, httpOptions)
            .toPromise().then(response => {
                if(response['success']) {
                    if(response['data'].rows_updated > 0) {
                        console.log('SE MODIFICÓ EL USUARIO CORRECTAMENTE EN LA TABLA');
                        resolve(1);
                    } else {
                        console.log('NO SE MODIFICÓ EL USUARIO CORRECTAMENTE EN LA TABLA');
                        resolve(0);
                    }
                } else {
                    resolve(-1);
                }
            }).catch(error => reject(
                resolve(-1)
            ));
        });
    }

    generateUpdateUSerBody(app_code: string, campo: string, valor: string | number) {
        const data = {
            "tabla": "integracion_usuario",
            "operador": "and",
            "valores": {
                "cedula": valor
            },
            "condiciones": [
                {
                    "columna": "telefono_id",
                    "comparador": "==",
                    "valor": app_code
                }
            ]
        }
        return JSON.stringify(data);
    }

    generateUpdateScoreBody(pendingScores: any[], phone_id: string | number, datetime: string){
        const values = {};
        pendingScores.forEach(score => {
            values[`score_${score.hour}`] = score.score;
        });
        const data = {
            "tabla": "integracion_score_diario",
            "operador": "and",
            "valores": values,
            "condiciones": [
                {
                    "columna": "telefono_id",
                    "comparador": "==",
                    "valor": phone_id
                },
                {
                    "columna": "dia",
                    "comparador": "==",
                    "valor": datetime
                }
            ]
        };
        return JSON.stringify(data);
    }

    generateInsertScoreBody(phone_id: string | number, datetime: string){
        const data = {
            "tabla": "integracion_score_diario",
            "datos": [
            {
                "telefono_id": phone_id,
                "dia": datetime,
                "score_0": 20
            }
            ]
        };
        return JSON.stringify(data);
    }

    generateReadTestBody(sampleId: string){
        const data = {
            "tabla": "integracion_pruebas",
            "condiciones": [
                {
                    "columna": "muestra_id",
                    "comparador": "==",
                    "valor": sampleId
                }
            ]
        };
        return JSON.stringify(data);
    }

}
