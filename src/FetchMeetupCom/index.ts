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

                const rawJson = JSON.parse(
                    dom.window.document.querySelector('script[id="__NEXT_DATA__"]')?.textContent as string) as any;

                let happenings = [];

                const state = rawJson['props']?.['pageProps']?.['__APOLLO_STATE__'];
                if (state) {
                    const states = Object.values(state) as any[];
                    const group = states.find(s => s['__typename'] === 'Group');
                    const rawEvents = states.filter(s => s['__typename'] === 'Event');

                    if (group && rawEvents) {
                        happenings = rawEvents.map(
                            (rawEvent: any) => {
                                return <Happening>{
                                    id: `${rawEvent.id}@mxa.meetup.com`,
                                    meetupName: group.name,
                                    eventName: rawEvent.title,
                                    url: rawEvent.eventUrl,
                                    startTime: dayjs(rawEvent.dateTime).utc(),
                                    endTime: dayjs(rawEvent.endTime).utc(),
                                };
                            }
                        );
                    }
                }

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
