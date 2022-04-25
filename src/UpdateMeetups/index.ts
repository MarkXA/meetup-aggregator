import { AzureFunction, Context } from "@azure/functions"
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc.js';
import ical from 'ical-generator';
import * as jsdom from 'jsdom';
import fetch from 'node-fetch';
import { meetupList } from '../meetupList.js';
dayjs.extend(utc);

type MeetupEvent = {
    id: string;
    meetupName: string;
    eventName: string;
    url: string;
    startTime: dayjs.Dayjs;
    endTime: dayjs.Dayjs;
}

const timerTrigger: AzureFunction = async function (context: Context): Promise<void> {
    context.log('UpdateMeetups triggered');

    const allEvents: MeetupEvent[] = [];

    allEvents.push(...manualEntryEvents(meetupList.manualEntry));
    allEvents.push(...(await fetchEventbriteEvents(meetupList.eventbriteIds, context)));
    allEvents.push(...(await fetchMeetupComEvents(meetupList.meetupComIds, context)));

    const now = dayjs();
    const futureEvents = allEvents.filter(e => e.startTime.isAfter(now));

    futureEvents.sort((a, b) => {
        return a.startTime.diff(b.startTime);
    });

    context.log(JSON.stringify(futureEvents));

    const calendar = ical({
        name: 'NI tech meetups',
        description: 'All the Northern Ireland tech meetups we know about'
    });

    for (const event of futureEvents) {
        calendar.createEvent({
            id: event.id,
            summary: `${event.meetupName}: ${event.eventName}`,
            description: `Full information at ${event.url}`,
            url: event.url,
            start: event.startTime,
            end: event.endTime,
        });
    };

    context.log(calendar.toString());

    context.bindings.jsonBlob = JSON.stringify(futureEvents);
    context.bindings.icalBlob = calendar.toString();
};

const fetchMeetupComEvents = async function (meetupIds: string[], context: Context): Promise<MeetupEvent[]> {
    const result = [];

    for (const meetupId of meetupIds) {
        context.log('Fetching events for Meetup.com ID', meetupId);

        for (let n = 0; n < 3; n++) {
            try {
                const response = await fetch(`https://www.meetup.com/${meetupId}/events/`);
                const html = await response.text();
                const dom = new jsdom.JSDOM(html);

                const rawEvents = JSON.parse(
                    dom.window.document.querySelector('script[type="application/ld+json"]')?.textContent as string) as Array<any>;

                const meetupEvents = rawEvents.length ? rawEvents.map(
                    (rawEvent: any) => {
                        return <MeetupEvent>{
                            id: rawEvent.url.split('/').at(-2) + '@mxa.meetup.com',
                            meetupName: rawEvent.organizer.name,
                            eventName: rawEvent.name,
                            url: rawEvent.url,
                            startTime: dayjs(rawEvent.startDate).utc(),
                            endTime: dayjs(rawEvent.endDate).utc(),
                        };
                    }
                ) : [];

                context.log(JSON.stringify(meetupEvents));

                if (meetupEvents.length > 0 && meetupEvents.every(e => e.url.startsWith(`https://www.meetup.com/${meetupId}/`))) {
                    result.push(...meetupEvents);
                    break;
                }
            } catch (e) {
                context.log('Caught exception:', e);
            }
        }
    }

    return result;
}

const fetchEventbriteEvents = async function (meetupIds: string[], context: Context): Promise<MeetupEvent[]> {
    const result = [];

    for (const meetupId of meetupIds) {
        context.log('Fetching events for Eventbrite ID', meetupId);

        for (let n = 0; n < 3; n++) {
            const response = await fetch(`https://www.eventbrite.co.uk/o/${meetupId}`);
            const html = await response.text();
            const dom = new jsdom.JSDOM(html);

            const rawEvents = JSON.parse(
                (Array.from(dom.window.document.querySelectorAll('script[type="application/ld+json"]')) as Array<any>).at(-1)?.textContent as string) as Array<any>;

            const meetupEvents = rawEvents.length ? rawEvents.map(
                (rawEvent: any) => {
                    return <MeetupEvent>{
                        id: rawEvent.url.split('/').at(-1) + '@mxa.meetup.com',
                        meetupName: rawEvent.organizer.name,
                        eventName: rawEvent.name,
                        url: rawEvent.url,
                        startTime: dayjs(rawEvent.startDate).utc(),
                        endTime: dayjs(rawEvent.endDate).utc(),
                    };
                }
            ) : [];

            context.log(JSON.stringify(meetupEvents));

            if (meetupEvents.length > 0 && rawEvents.every(e => e.organizer.url.endsWith(`/${meetupId}`))) {
                if (meetupId.startsWith('bcs-')) {
                    result.push(...meetupEvents.filter(e => e.eventName.indexOf('Northern Ireland') !== -1));
                } else {
                    result.push(...meetupEvents);
                }
                break;
            }
        }
    }

    return result;
}

const manualEntryEvents = function (meetupEvents: any[]): MeetupEvent[] {
    return meetupEvents.map(
        (meetupEvent: any) => {
            return <MeetupEvent>{
                id: `${meetupEvent.id}@mxa.meetup.com`,
                meetupName: meetupEvent.meetupName,
                eventName: meetupEvent.eventName,
                url: meetupEvent.url,
                startTime: dayjs(meetupEvent.startTime).utc(),
                endTime: dayjs(meetupEvent.endTime).utc(),
            };
        }
    );
}

export default timerTrigger;
