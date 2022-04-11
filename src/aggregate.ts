/* eslint-disable require-jsdoc */

type meetupEvent = {
  name: string;
  url: string;
  startDate: string;
  endDate: string;
}

import dayjs from 'dayjs';
import fetch from 'node-fetch';
import jsdom from 'jsdom';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc);

const response = await fetch('https://www.meetup.com/DevOps-Belfast/events/');
const html = await response.text();
const dom = new jsdom.JSDOM(html);

const events = JSON.parse(dom.window.document.querySelector(
    'script[type="application/ld+json"]')?.textContent as string) as
    Array<meetupEvent>;

const name = events[0].name;
const startDate = dayjs.utc(events[0].startDate);

console.log(name);
console.log(startDate.format());
