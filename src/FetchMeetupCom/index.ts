import axios from 'axios';
import { AzureFunction, Context } from "@azure/functions"
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc.js';
import * as jsdom from 'jsdom';
import { Happening } from "../happening";
import { meetupList } from '../meetupList.js';
dayjs.extend(utc);

const activityFunction: AzureFunction = async function (context: Context): Promise<Happening[]> {
    const result: Happening[] = [];

    for (const meetupId of meetupList.meetupComIds) {
        context.log('Fetching events for Meetup.com ID', meetupId);

        for (let n = 0; n < 3; n++) {
            try {
                const html = (await axios.get(`https://www.meetup.com/${meetupId}/events/`)).data;
                const dom = new jsdom.JSDOM(html);

                const rawEvents = JSON.parse(
                    dom.window.document.querySelector('script[type="application/ld+json"]')?.textContent as string) as Array<any>;

                const happenings = rawEvents.length ? rawEvents.map(
                    (rawEvent: any) => {
                        return <Happening>{
                            id: `${rawEvent.url.split('/').at(-2)}@mxa.meetup.com`,
                            meetupName: rawEvent.organizer.name,
                            eventName: rawEvent.name,
                            url: rawEvent.url,
                            startTime: dayjs(rawEvent.startDate).utc(),
                            endTime: dayjs(rawEvent.endDate).utc(),
                        };
                    }
                ) : [];

                context.log(JSON.stringify(happenings));

                if (happenings.length > 0 && happenings.every(e => e.url.toLowerCase().startsWith(`https://www.meetup.com/${meetupId.toLowerCase()}/`))) {
                    result.push(...happenings);
                    break;
                }
            } catch (e) {
                context.log('Caught exception:', e);
            }
        }
    }

    return result;
};

export default activityFunction;
