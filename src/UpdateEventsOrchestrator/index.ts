import * as df from "durable-functions"
import * as dayjs from 'dayjs';
import ical from 'ical-generator';
import { Happening } from "../happening";

const orchestrator = df.orchestrator(function* (context) {
    const tasks = ['FetchManual', 'FetchEventbrite', 'FetchMeetupCom', 'FetchIcal'].map(
        activity => context.df.callActivity(activity)
    );

    const happenings: Happening[] = (yield context.df.Task.all(tasks)).flat().map(h => <Happening>{
        id: h.id,
        meetupName: h.meetupName,
        eventName: h.eventName,
        url: h.url,
        startTime: dayjs(h.startTime),
        endTime: dayjs(h.endTime),
    });

    const now = dayjs(context.df.currentUtcDateTime);
    const futureHappenings = happenings.filter(e => e.startTime.isAfter(now));

    futureHappenings.sort((a, b) => {
        return a.startTime.diff(b.startTime);
    });

    context.log(JSON.stringify(futureHappenings));

    const calendar = ical({
        name: 'NI tech meetups',
        description: 'All the Northern Ireland tech meetups we know about'
    });

    for (const happening of futureHappenings) {
        calendar.createEvent({
            id: happening.id,
            summary: `${happening.meetupName}: ${happening.eventName}`,
            description: `Full information at ${happening.url}`,
            url: happening.url,
            start: happening.startTime,
            end: happening.endTime,
        });
    };

    context.log(calendar.toString());

    context.bindings.jsonBlob = JSON.stringify(futureHappenings);
    context.bindings.icalBlob = calendar.toString();
});

export default orchestrator;
