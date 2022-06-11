import { AzureFunction, Context } from "@azure/functions"
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc.js';
import { Happening } from "../happening";
import { meetupList } from '../meetupList.js';
dayjs.extend(utc);

const activityFunction: AzureFunction = async function (context: Context): Promise<Happening[]> {
    return meetupList.manualEntry.map(
        (meetupEvent: any) => {
            return <Happening>{
                id: `${meetupEvent.id}@mxa.meetup.com`,
                meetupName: meetupEvent.meetupName,
                eventName: meetupEvent.eventName,
                url: meetupEvent.url,
                startTime: dayjs(meetupEvent.startTime).utc(),
                endTime: dayjs(meetupEvent.endTime).utc(),
            };
        }
    );
};

export default activityFunction;
