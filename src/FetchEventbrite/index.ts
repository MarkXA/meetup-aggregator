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
    const now = dayjs();

    for (const meetupId of meetupList.eventbriteIds) {
        context.log('Fetching events for Eventbrite ID', meetupId);

        for (let n = 0; n < 3; n++) {
            const html = (await axios.get(`https://www.eventbrite.co.uk/o/${meetupId}`)).data;
            const dom = new jsdom.JSDOM(html);

            const rawEvents = JSON.parse(
                (Array.from(dom.window.document.querySelectorAll('script[type="application/ld+json"]')) as Array<any>).at(-1)?.textContent as string) as Array<any>;

            const happenings = [];
            if (rawEvents.length) {
                for (const rawEvent of rawEvents) {
                    if (dayjs(rawEvent.endDate).isBefore(now))
                        continue;

                    const eventbriteId = rawEvent.url.split('-').at(-1);
                    const series = (await axios.get(`https://www.eventbrite.co.uk/api/v3/destination/events/?event_ids=${eventbriteId}&expand=series&page_size=50&include_parent_events=false`)).data;
                    const nextDates =
                        series.events
                        && series.events.length
                        && series.events[0].series
                        && series.events[0].series.next_dates;
                    if (nextDates) {
                        for (const dates of nextDates) {
                            happenings.push(<Happening>{
                                id: `${rawEvent.url.split('/').at(-1)}-${dates.id}@mxa.meetup.com`,
                                meetupName: rawEvent.organizer.name,
                                eventName: rawEvent.name,
                                url: rawEvent.url,
                                startTime: dayjs(dates.start).utc(),
                                endTime: dayjs(dates.end).utc(),
                            });
                        };
                    } else {
                        happenings.push(<Happening>{
                            id: `${rawEvent.url.split('/').at(-1)}@mxa.meetup.com`,
                            meetupName: rawEvent.organizer.name,
                            eventName: rawEvent.name,
                            url: rawEvent.url,
                            startTime: dayjs(rawEvent.startDate).utc(),
                            endTime: dayjs(rawEvent.endDate).utc(),
                        });
                    }
                }
            }

            context.log(JSON.stringify(happenings));

            if (happenings.length > 0 && rawEvents.every(e => e.organizer.url.endsWith(`/${meetupId}`))) {
                if (meetupId.startsWith('bcs-')) {
                    result.push(...happenings.filter(e => e.eventName.indexOf('Northern Ireland') !== -1));
                } else {
                    result.push(...happenings);
                }
                break;
            }
        }
    }

    return result;
};

export default activityFunction;
