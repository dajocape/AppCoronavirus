import { Component, OnInit, NgZone } from '@angular/core';
import { App, Events } from 'ionic-angular';
import { StorageProvider } from '../../providers/storage/storage';
import { AuthPage } from '../auth/auth';
import { LocationProvider } from '../../providers/location/location';
import { ScoreProvider } from '../../providers/score/score';
import { ValidationsProvider } from '../../providers/validations/validations';
import { APIProvider } from '../../providers/api/api';
import { AlertProvider } from '../../providers/alert/alert';
import { LocalNotifications } from '@ionic-native/local-notifications';

import * as plantilla from '../../assets/plantilla/plantilla.json';
import { DatabaseProvider } from '../../providers/database/database';

@Component({
	selector: 'page-user',
    templateUrl: 'user.html',
})

export class UserPage implements OnInit{

    templates = (<any>plantilla);
    currentScore: number;
    currentScoreColor: string;
    homeLocationDate: number;
    scores: any;
    colors: any;
    homeRadius: number;
    showingForm: boolean;
    notifications;
    id;

    constructor(
        private app: App,
        private storage: StorageProvider,
        private location: LocationProvider,
        private database: DatabaseProvider,
        private scoreService: ScoreProvider,
        private api: APIProvider,
        private events: Events,
        private ngZone: NgZone,
        private localNotifications: LocalNotifications,
        private validations: ValidationsProvider,
        private alert: AlertProvider
        ) {
            this.events.subscribe('scoreChanges', (score: number) => {
                this.updateCurrentScore(score);
                this.updateCurrentScoreColor(score);
                this.fillScores();
            });

            this.setNotificaciones();
         }

    ngOnInit() {
        console.log('ngOnInit UserPage');

        this.colors = {'1': '#49BEAA', '2': '#EEB868', '3': '#EF767A', '-1': '#999999'};
        this.showingForm = true;

        this.storage.get('homeLocation').then(location => {
            if(location) {
                this.homeLocationDate = location.date;
                this.showingForm = false;
                this.scoreService.calculateAndStoreExpositionScores();
            }
        });
        this.fillScores();
    }

    async setNotificaciones() {
        var notifications = await this.storage.getNotifications();
        if(notifications) {
            this.notifications = notifications;
        } else {
            this.notifications = {};
        }
        this.id = 0;

        for (let template of this.templates) {
            if(this.notifications[template.name]) {
                this.localNotifications.cancel(this.notifications[template.name]);
            }
            this.notifications[template.name] = new Array();
            if (template.notifications) {
                for (let noti of template.notifications) {
                    var nombre = template.name;
                    var tipo = template.type;

                    if (noti.type == 'SIMPLE') {
                        for (let no of noti.children) {
                            var fecha = no.date.split('-');
                            var hora = no.time.split(':');
                            this.localNotifications.schedule({
                                id: this.id,
                                title: 'REPORTE DE SALUD',
                                text: 'Se le recuerda que debe llenar un nuevo reporte diario de salud en caso de que no lo haya hecho el día de hoy',
                                trigger: { at: new Date(fecha[0], fecha[1] - 1, fecha[2], hora[0], hora[1], 0) },
                                led: 'FF0000'
                            });
                            this.notifications[template.name].push(this.id);
                            this.id++;
                        }
                    } else if (noti.type == 'PERIÓDICA') {
                        var interval_type = noti.interval_type;
                        var interval_value = noti.interval_value;
                        var fecha_noti;

                        for (let no of noti.children) {
                            var fecha = no.date.split('-');
                            var hora = no.time.split(':');
                            if (no.type == 'start') {
                                var fecha_inicio = new Date(fecha[0], fecha[1] - 1, fecha[2], hora[0], hora[1], 0);
                            } else {
                                var fecha_fin = new Date(fecha[0], fecha[1] - 1, fecha[2], hora[0], hora[1], 0);
                            }
                        }

                        fecha_noti = new Date(fecha_inicio.getFullYear(), fecha_inicio.getMonth(), fecha_inicio.getDate(), fecha_inicio.getHours(), fecha_inicio.getMinutes(), 0);

                        do {
                            this.localNotifications.schedule({
                                id: this.id,
                                title: 'REPORTE DE SALUD',
                                text: 'Se le recuerda que debe llenar un nuevo reporte diario de salud en caso de que no lo haya hecho el día de hoy',
                                trigger: { at: new Date(fecha_noti.getFullYear(), fecha_noti.getMonth(), fecha_noti.getDate(), fecha_noti.getHours(), fecha_noti.getMinutes(), 0) },
                                led: 'FF0000'
                            });

                            this.notifications[template.name].push(this.id);

                            if (interval_type == 'minute') {
                                fecha_noti.setTime(fecha_noti.getTime() + (interval_value * 60 * 1000));
                            } else if (interval_type == 'hour') {
                                fecha_noti.setTime(fecha_noti.getTime() + (interval_value * 60 * 60 * 1000));
                            } else if (interval_type == 'day') {
                                fecha_noti.setTime(fecha_noti.getTime() + (interval_value * 24 * 60 * 60 * 1000));
                            } else if (interval_type == 'week') {
                                fecha_noti.setTime(fecha_noti.getTime() + (interval_value * 7 * 24 * 60 * 60 * 1000));
                            } else if (interval_type == 'month') {
                                fecha_noti.setTime(fecha_noti.getTime() + (interval_value * 30 * 24 * 60 * 60 * 1000));
                            }

                            this.id++;

                        } while (fecha_noti.getTime() <= fecha_fin.getTime());
                    } else if(noti.type == 'PERIÓDICA_HORA_FIJA') {
                        var interval_type = noti.interval_type;
                        var interval_value = noti.interval_value;
                        var fecha_noti, fecha;
                        var dias = [];
                        var f2, f1;
                        var fecha_i = noti.dates[0];
                        var fecha_fi = noti.dates[noti.dates.length - 1];
                        var temp = fecha_fi.split('-');
                        var fecha_f = new Date(temp[0], temp[1] - 1, temp[2], 0, 0);

                        do {
                            dias.push(fecha_i);
                            f1 = fecha_i.split('-');
                            f1 = new Date(f1[0], f1[1] - 1, f1[2], 0, 0);
                            f2 = new Date(f1.getTime() + (interval_value * 24 * 60 * 60 * 1000));
                            fecha_i = f2.getFullYear() + '-' + (f2.getMonth()+1) + '-' + f2.getDate();
                        } while(f2.getTime() <= fecha_f.getTime());

                        for(let fe of dias) {
                            fecha = fe.split('-');

                            for(let ti of noti.times) {
                                var hora = ti.split(':');
                                fecha_noti = new Date(fecha[0], fecha[1] - 1, fecha[2], hora[0], hora[1], 0);

                                /*this.localNotifications.schedule({
                                    id: this.id,
                                    icon: 'file://assets/imgs/logo_notification.png',
                                    title: 'REPORTE DE SALUD',
                                    text: 'Se le recuerda que debe llenar un nuevo reporte diario de salud en caso de que no lo haya hecho el día de hoy',
                                    trigger: {at: new Date(fecha_noti.getFullYear(), fecha_noti.getMonth(), fecha_noti.getDate(), fecha_noti.getHours(), fecha_noti.getMinutes(), 0)},
                                    led: 'FF0000'
                                });*/

                                this.notifications[template.name].push(this.id);
                                this.id++;
                            }
                        }
                    }
                }
            }
        }
        this.notifications['totalQuantity'] = this.id;
        console.log("NOTIFICACIONES:", this.notifications);
        this.storage.setNotifications(this.notifications);

    }

    fillScores() {
        this.database.getScores().then(scores => {
            scores.forEach(score => {
                score.color = this.getColorByScore(score.score);
            });

            let scoresToShow = scores;

            for(let i = scoresToShow.length + 1; i < 25; i++){
                const missingScore = {'hour': i, 'score': -1};
                missingScore['color'] = this.getColorByScore(missingScore.score);
                scoresToShow.push(missingScore);
            }

            this.updateScores(scoresToShow);
        });
    }

    updateCurrentScore(score: number) {
        this.ngZone.run(() => {
            this.currentScore = score || -1;
        });
    }

    updateCurrentScoreColor(score: number) {
        this.ngZone.run(() => {
            this.currentScoreColor = this.getColorByScore(score);
        });
    }

    updateScores(scores: any[]) {
        this.ngZone.run(() => {
            this.scores = scores;
        });
    }

    getColorByScore(score: number) {
        return this.colors[Math.ceil(score)];
    }

	cerrarSesion() {
        this.storage.setUser(null).then(() => {
            this.app.getRootNav().setRoot(AuthPage);
        });
    }

    async registerHomeHandler(radius) {
        if(this.homeRadius !== undefined && this.validations.validateHomeRadius(radius)) {

            this.scoreService.startScan().then(numberOfWifiNetworks => {
                console.log('homeWifiNetworks set');
                return this.storage.set('homeWifiNetworks', numberOfWifiNetworks);
            }).then(() => {
                console.log('homeRadius set');
                return this.storage.set('homeRadius', this.homeRadius);
            }).then(() => {
                this.homeRadius = undefined;
                console.log('getCurrentLocation called');
                return this.location.getCurrentLocation();
            }).then(location => {
                console.log('getCurrentLocation resolved');
                this.homeLocationDate = location.timestamp;

                return this.storage.set('homeLocation', {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    date: location.timestamp
                });
            }).then(() => {
                this.alert.saveHomeInfoSuccess();

                this.showingForm = false;
                this.api.postHomeInformation();
                this.scoreService.startBackgroundGeolocation();
                this.scoreService.calculateAndStoreExpositionScores();
            }).catch(() => {
                this.alert.saveHomeInfoError();
            });

        } else {
            this.alert.radiusError();
        }
    }

    getDateFromeTimestamp(timestamp: number) {
        const date = new Date(timestamp);
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    }

    scoreInformation(){
        this.alert.scoreInformation();
    }

    infoHomeLocation() {
        this.alert.infoHomeLocation();
    }

    onEnterKey(e) {
        if (e.keyCode == 13) {
            let activeElement = <HTMLElement>document.activeElement;
            activeElement && activeElement.blur && activeElement.blur();
        }
      }
}
