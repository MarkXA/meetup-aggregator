import * as dayjs from 'dayjs';

export type Happening = {
    id: string;
    meetupName: string;
    eventName: string;
    url: string;
    startTime: dayjs.Dayjs;
    endTime: dayjs.Dayjs;
}
