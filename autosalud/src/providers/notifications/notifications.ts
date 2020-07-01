import { Injectable } from '@angular/core';

import * as moment from 'moment';

import { LocalNotifications } from '@ionic-native/local-notifications';
import { StorageProvider } from '../storage/storage';

/*
  Generated class for the NotificationsProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class NotificationsProvider {

    constructor(private localNotifications: LocalNotifications, private storage: StorageProvider) {
        console.log('Hello NotificationsProvider Provider');
        this.localNotifications.setDefaults({
            title: 'REPORTE DE SALUD',
            text: 'Se le recuerda que debe llenar un nuevo reporte diario de salud en caso de que no lo haya hecho el día de hoy',
            vibrate: true,
        });
    }

    clearTriggeredNotifications() {
        this.localNotifications.getTriggeredIds().then(ids => {
            if(ids != null) {
                this.localNotifications.clear(ids);
            }
        }).catch(console.log);
    }

    async setFollowUpNotifications(start: Date, duration: number, time: string) {
        const formTemplates = await this.storage.get('formTemplates');
        const formTemplate = formTemplates.follow_up[0];
        formTemplate.notifications = [
            this.getFormNotificationData(start, duration, time)
        ];
        await this.storage.set('formTemplates', formTemplates);
        this.setNotificaciones(formTemplate);
    }

    private getFormNotificationData(start: Date, duration: number, time: string) {
        if(moment().format('hh:mm') >= time) {
            start.setDate(start.getDate() + 1)
        }
        const end = new Date(start);
        end.setDate(start.getDate() + duration - 1);
        return {
            'type': 'PERIÓDICA',
            'interval_type': 'day',
            'interval_value': '1',
            'children': [
                {
                    'type': 'start',
                    'date': moment(start).format('YYYY-MM-DD'),
                    'time': time
                },
                {
                    'type': 'end',
                    'date': moment(end).format('YYYY-MM-DD'),
                    'time': time
                }
            ]
        }
    }

    setNotificaciones(template: any) {
        for(let notification of template.notifications) {
            if(notification.type === 'SIMPLE') {
                this.setSimpleFormNotification(notification);
            } else if(notification.type === 'PERIÓDICA') {
                this.setPeriodicFormNotification(notification);
            }
        }
    }

    private setSimpleFormNotification(notification: any) {
        for(const notificationChildren of notification.children) {
            const date = this.getDateFromNotificationChildren(notificationChildren);
            this.localNotifications.schedule({
                id: new Date().getMilliseconds(),
                trigger: { at: date }
            });
        }
    }

    private setPeriodicFormNotification(notification: any) {
        const startDate = this.getDateFromNotificationChildren(notification.children[0]);
        const endDate = this.getDateFromNotificationChildren(notification.children[1]);

        const notificationDate = new Date(startDate);
        const interval = this.getInterval(notification.interval_type, notification.interval_value);

        while(notificationDate.getTime() <= endDate.getTime()) {
            this.localNotifications.schedule({
                id: new Date().getMilliseconds(),
                trigger: { at: new Date(notificationDate) },
            });
            notificationDate.setTime(notificationDate.getTime() + interval);
        }
    }

    private getInterval(intervalType: string, intervalValue: string | number) {
        const intervalMapping = {
            minute: 60 * 1000,
            hour:   60 * 60 * 1000,
            day:    24 * 60 * 60 * 1000,
            week:    7 * 24 * 60 * 60 * 1000,
            month:  30 * 24 * 60 * 60 * 1000
        }
        return Number(intervalValue) * intervalMapping[intervalType];
    }

    private getDateFromNotificationChildren(children: any) {
        const dateString = `${children.date} ${children.time}`;
        return moment(dateString, 'YYYY-MM-DD hh:mm').toDate();
    }
}
