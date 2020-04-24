import { Injectable } from '@angular/core';
import * as Constants from '../../data/constants';
import { StorageProvider } from '../../providers/storage/storage';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Encoding } from "@ionic-native/google-maps";

import * as moment from 'moment';
import { DatabaseProvider } from '../database/database';


/*
  Generated class for the ScoreSenderProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class APIProvider {

    constructor(
        private database: DatabaseProvider,
        private storage: StorageProvider,
        private httpClient: HttpClient
    ) {
        console.log('Hello ScoreSenderProvider Provider');
    }

    async sendPendingScoresToServer(){
        const scores = await this.database.getScores();
        const pendingScores = [];
        scores.forEach(score => {
            if(score.status === 'PENDING' && score.score !== -1){
                if(score.hour === 24 ) score.hour = 0;
                pendingScores.push(score);
            }
        });

        if(pendingScores.length > 0) {
            const user = await this.storage.getUser();
            // FIXME: Get date from scores table in database
            const date = this.getCurrentStringDate();
            await this.sendPostRequest(pendingScores, user, date);
        }
    }

    async sendPostRequest(pendingScores: any[], phone_id: string | number, datetime: string){
        console.log('Sending cores');
        const data = this.generateUpdateScoreBody(pendingScores, phone_id, datetime);
        const httpOptions = {
            headers: new HttpHeaders({ 'Content-Type': 'application/json' })
        };

        this.httpClient.post(Constants.UPDATE_REGISTRY_URL, data, httpOptions)
        .toPromise().then((response: any) => {
            console.log('UPDATE RESPONSE', response);
            const updated = response.data.rows_updated;
            if(updated) {
                console.log('UPDATE ON SERVER');
                pendingScores.forEach(score => {
                    this.database.updateScoreStatus(score.id, 'SENT').then(result => {
                        console.log('SUCCESS UPDATE SCORE IN LOCAL DATABASE', result);
                    }).catch(error => {
                        console.log('ERROR UPDATE SCORE IN LOCAL DATABASE', error);
                    });
                });

            } else {
                const data = this.generateInsertScoreBody(phone_id, datetime);
                this.httpClient.post(Constants.CREATE_REGISTRY_URL, data, httpOptions)
                .toPromise().then(response => {
                    console.log('SUCCESS CREATE', response);
                    this.sendPostRequest(pendingScores, phone_id, datetime);
                }).catch(error => {
                    console.log('error when creating scores', error);
                });
            }
        }).catch(error => {
            console.log("Error when updating", error);
        });
    }

    getTestResultsByAppId(appId: string) {
        return new Promise<any>((resolve, reject) => {
            console.log('Requesting tests...');
            const data = this.generateReadTestBody(appId);
            const httpOptions = {
                headers: new HttpHeaders({ 'Content-Type': 'application/json' })
            };
            this.httpClient.post(Constants.READ_REGISTRY_URL, data, httpOptions)
            .toPromise().then(response => {
                resolve(response['data']);
            }).catch(error => reject(error));
        });
    }

    async postHomeInformation() {
        const user = await this.storage.getUser();
        const homeLocation = await this.storage.get('homeLocation');
        const homeRadius = await this.storage.get('homeRadius');
        const scores = await this.database.getScores();
        // FIXME: Pass in current max distance and time to compare to previous days
        const maxDistanceAway = this.getMaxDistanceAway(scores);
        const maxTimeAway = this.getMaxTimeAway(scores);

        const data = this.generateUpdateHomeBody(
            user,
            homeLocation,
            homeRadius,
            maxDistanceAway,
            maxTimeAway
        );
        const httpOptions = {
            headers: new HttpHeaders({ 'Content-Type': 'application/json' })
        };

        this.httpClient.post(Constants.UPDATE_REGISTRY_URL, data, httpOptions)
        .toPromise().then((response: any) => {
            console.log('UPDATE HOME RESPONSE', response);
            const updated = response.data.rows_updated;
            if(!updated) {
                const data = this.generateInsertHomeBody(
                    user,
                    homeLocation,
                    homeRadius,
                    maxDistanceAway,
                    maxTimeAway
                );
                this.httpClient.post(Constants.CREATE_REGISTRY_URL, data, httpOptions)
                .toPromise().then((response: any) => {
                    console.log('SUCCESS HOME CREATE', response);
                }).catch(error => {
                    console.log('error when creating home', error);
                });
            }
        }).catch(error => {
            console.log("Error when updating home", error);
        });
    }

    validateAppCode(app_code: string) {
        return new Promise<any>((resolve, reject) => {
            const httpOptions = {
                headers: new HttpHeaders({ 'Content-Type':'application/json','Authorization':'491c5713-dd3e-4dda-adda-e36a95d7af77'  })
            };
            const data = this.generateValidationCodeBody(app_code);
            console.log("ENTRO A VALIDAR");
            this.httpClient.post(Constants.READ_REGISTRY_URL, data, httpOptions)
            .toPromise().then((response: any) => {
                if(response.data.length > 0 && response['data'][0].en_uso === 1) {
                    console.log('SUCCESS READ', response['data'][0].en_uso);
                    resolve(true);
                } else {
                    resolve(false);
                }
            }).catch(error => reject(error));
        });
    }

    createFormsDataSet(datasetId: string | number) {
        return new Promise<any>((resolve, reject) => {

            const data = this.generateCreateDatasetBody(datasetId);
            const httpOptions = {
                headers: new HttpHeaders({
                    'Content-Type':'application/json',
                    'Authorization': Constants.API_KEY
                })
            };

            this.httpClient.post(Constants.CREATE_DATASET_URL, data, httpOptions)
            .toPromise().then(() => {
                console.log("EXITO AL CREAR DATASET");
                resolve(1);
            }).catch(error => {
                if(error.status === 409) {
                    resolve(0); // dataset already created
                }
                reject(error);
            });

        });
    }

    sendAppIdToEmail(cedula: string, emailAddress: string) {
        return new Promise<any>((resolve, reject) => {
            const data = this.generateSendAppIdToEmailBody(cedula, emailAddress);
            const httpOptions = {
                headers: new HttpHeaders({ 'Content-Type':'application/json' })
            };

            this.httpClient.post(Constants.SEND_EMAIL_URL, data, httpOptions)
            .toPromise().then(() => {
                resolve(1);
            }).catch(error => {
                if(error.status === 404) resolve(0);
                reject(error);
            });
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

    generateUpdateScoreBody(pendingScores: any[], phone_id: string | number, datetime: string){
        const values = {};
        pendingScores.forEach(score => {
            values[`score_${score.hour}`] = score.score;
        });
        values['gps_point'] = this.joinEncodedRoutes(pendingScores);
        const data = {
            "tabla": "integracion_score_diario",
            "valores": values,
            "condiciones": [
                {
                    "columna": "telefono_id",
                    "comparador": "==",
                    "valor": phone_id
                }
            ]
        };
        return JSON.stringify(data);
    }

    joinEncodedRoutes(pendingScores: any[]) {
        const points = [];
        pendingScores.forEach(score => {
            if(score.encoded_route) {
                const decoded = Encoding.decodePath(score.encoded_route);
                points.push(...decoded);
            }
        });
        return Encoding.encodePath(points);
    }

    generateInsertScoreBody(phone_id: string | number, datetime: string){
        const data = {
            "tabla": "integracion_score_diario",
            "datos": [
                {
                    "telefono_id": phone_id,
                    "dia": datetime
                }
            ]
        };
        return JSON.stringify(data);
    }

    generateReadTestBody(appId: string){
        const data = {
            "tabla": "integracion_pruebas",
            "condiciones": [
                {
                    "columna": "app_id",
                    "comparador": "==",
                    "valor": appId
                }
            ]
        };
        return JSON.stringify(data);
    }

    generateUpdateHomeBody(
        appId: string,
        homeLocation: any,
        homeRadius: any,
        maxDistanceAway: number,
        maxTimeAway: number
    ) {
        const data = {
            "tabla": "integracion_usuario",
            "valores": {
                "lat_home": homeLocation.latitude,
                "long_home": homeLocation.longitude,
                "radio_mobilidad": maxDistanceAway,
                "ultimo_envio_datos": this.getCurrentStringDate()
            },
            "condiciones": [
                {
                    "columna": "telefono_id",
                    "comparador": "==",
                    "valor": appId
                }
            ]
        };
        return JSON.stringify(data);
    }

    generateInsertHomeBody(
        appId: string,
        homeLocation: any,
        homeRadius: any,
        maxDistanceAway: number,
        maxTimeAway: number
    ) {
        const data = {
            "tabla": "integracion_usuario",
            "datos": [
                {
                    "telefono_id": appId,
                    "lat_home": homeLocation.latitude,
                    "long_home": homeLocation.longitude,
                    "radio_mobilidad": maxDistanceAway,
                    "ultimo_envio_datos": this.getCurrentStringDate()
                }
            ]
        };
        return JSON.stringify(data);
    }

    generateCreateDatasetBody(datasetId: string | number) {
        const data = {
            name: datasetId.toString(),
            owner_org: Constants.OWNER_ORG
        };

        return JSON.stringify(data);
    }

    generateSendAppIdToEmailBody(cedula: string, emailAddress: string) {
        const data = {
            cedula: cedula,
            correo: emailAddress
        };

        return JSON.stringify(data);
    }

    getMaxDistanceAway(scores: any[]) {
        let maxDistanceAway = 0;
        scores.forEach(score => {
            if(score.score !== -1 && score.max_distance_home > maxDistanceAway){
                maxDistanceAway = score.max_distance_home;
            }
        });
        return maxDistanceAway;
    }

    getMaxTimeAway(scores: any[]) {
        let maxTimeAway = 0;
        scores.forEach(score => {
            if(score.score !== -1 && score.max_time_away > maxTimeAway){
                maxTimeAway = score.max_time_away;
            }
        });
        return maxTimeAway;
    }

    getCurrentStringDate() {
        return moment().startOf('day').format('YYYY-MM-DD hh:mm:ss');
    }
}
