import { AzureFunction, Context } from "@azure/functions"
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc.js';
import ical from 'ical-generator';
import * as jsdom from 'jsdom';
import fetch from 'node-fetch';
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
    const meetupIds = [
        'AWS-Usergroup-Belfast',
        'Azure-User-Group-Belfast',
        'BCS-Northern-Ireland',
        'Belfast-JS',
        'belfast-kafka',
        'belfast-lug',
        'Belfast-NET-Meetup',
        'BelfastJUG',
        'devbash',
        'DevOps-Belfast',
        'farsetlabs',
        'Google-Developer-Group-Belfast',
        'Ladies-that-UX-Belfast',
        'newry-digital',
        'nigmacommunity',
        'North-by-Northwest-Tech-Meetup',
        'OWASP-Belfast',
        'ppug_belfast',
        'ProductTank-Belfast',
        'PyBelfast',
        'UXBelfast',
        'women-in-tech-belfast',
        'Women-Who-Code-Belfast'
    ];

    const allEvents: MeetupEvent[] = [];

    for (const meetupId of meetupIds) {
        for (let n = 0; n < 3; n++) {
            const response = await fetch(`https://www.meetup.com/${meetupId}/events/`);
            const html = await response.text();
            const dom = new jsdom.JSDOM(html);

            const rawEvents = JSON.parse(
                dom.window.document.querySelector('script[type="application/ld+json"]')?.textContent as string) as Array<any>;

            context.log(meetupId);
            context.log(JSON.stringify(rawEvents));

            const meetupEvents = rawEvents.map(
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
            );

            context.log(JSON.stringify(meetupEvents));

            if (meetupEvents.length > 0 && meetupEvents.every(e => e.url.startsWith(`https://www.meetup.com/${meetupId}/`))) {
                allEvents.push(...meetupEvents);
                break;
            }
        }
    }

    allEvents.sort((a, b) => {
        return a.startTime.diff(b.startTime);
    });

    context.log(JSON.stringify(allEvents));

    const calendar = ical({
        name: 'NI tech meetups',
        description: 'All the Northern Ireland tech meetups we know about'
    });

    for (const event of allEvents) {
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

    context.bindings.jsonBlob = JSON.stringify(allEvents);
    context.bindings.icalBlob = calendar.toString();
};

export default timerTrigger;
