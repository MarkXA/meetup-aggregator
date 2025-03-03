import axios from 'axios';
import * as ical from 'node-ical';
import { AzureFunction, Context } from "@azure/functions"
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc.js';
import { Happening } from "../happening";
import { meetupList } from '../meetupList.js';
dayjs.extend(utc);

const activityFunction: AzureFunction = async function (context: Context): Promise<Happening[]> {
    const result: Happening[] = [];
    const now = dayjs();

    for (const icalInfo of meetupList.iCals) {
        context.log('Fetching events for iCal', icalInfo.url);

        const iCal = (await axios.get(icalInfo.url)).data;
        const events = ical.sync.parseICS(iCal);

        context.log(JSON.stringify(events));

        let happenings = Object.values(events)
            .filter(entry => entry.type === 'VEVENT')
            .map(iCalEvent => <Happening>{
                id: iCalEvent.uid,
                meetupName: icalInfo.meetupName,
                eventName: iCalEvent.summary,
                url: iCalEvent.url ?? (iCalEvent.location.startsWith('http') ? iCalEvent.location : undefined),
                startTime: dayjs(iCalEvent.start).utc(),
                endTime: dayjs(iCalEvent.end).utc(),
            });

        context.log(JSON.stringify(happenings));

        happenings = happenings.filter(happening => happening.endTime.isAfter(now));

        result.push(...happenings);
    }

    return result;
};

export default activityFunction;
