import { test, expect } from '@playwright/test';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define event storage location
const EVENTS_DATA_FILE = path.join(__dirname, '../data/foresters-events.json');

// Email configuration - read from environment variables or use defaults
const EMAIL_CONFIG = {
  user: process.env.EMAIL_USER || '',
  pass: process.env.GOOGLE_APP_PASSWORD || '',
  from: process.env.EMAIL_FROM || '',
  recipients: (process.env.EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
  debugRecipients: (process.env.DEBUG_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
};

// Login credentials
const LOGIN_CREDENTIALS = {
  username: process.env.FORESTERS_USERNAME || '',
  password: process.env.FORESTERS_PASSWORD || '',
};

// API search parameters
const SEARCH_PARAMS = {
  radius: process.env.SEARCH_RADIUS || "0",
  zipcode: process.env.SEARCH_ZIPCODE || "NP44 6EP",
  countryCode: process.env.SEARCH_COUNTRY_CODE || "GB",
};

// Simple interface for event data
interface ForestersEvent {
  eventId: string;
  eventName: string;
  description: string;
  startDate: string;
  endDate: string;
  building: {
    name: string;
    addressLine1?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
  };
  image?: {
    eventcardimage?: string;
  };
  registrationCount: number;
  openSpotsleft: number;
  activityFull: boolean;
}

interface EventsData {
  lastUpdated: string;
  events: ForestersEvent[];
}

// Make sure the data directory exists
if (!fs.existsSync(path.dirname(EVENTS_DATA_FILE))) {
  fs.mkdirSync(path.dirname(EVENTS_DATA_FILE), { recursive: true });
}

// Helper function to load existing events
function loadExistingEvents(): EventsData {
  if (!fs.existsSync(EVENTS_DATA_FILE)) {
    return {
      lastUpdated: new Date().toISOString(),
      events: []
    };
  }

  try {
    const data = fs.readFileSync(EVENTS_DATA_FILE, 'utf-8');
    return JSON.parse(data) as EventsData;
  } catch (error) {
    console.error('Error loading existing events:', error);
    return {
      lastUpdated: new Date().toISOString(),
      events: []
    };
  }
}

// Helper function to save events
function saveEvents(eventsData: EventsData): void {
  try {
    fs.writeFileSync(
      EVENTS_DATA_FILE,
      JSON.stringify(eventsData, null, 2),
      'utf-8'
    );
    console.log(`Events saved to ${EVENTS_DATA_FILE}`);
  } catch (error) {
    console.error('Error saving events data:', error);
  }
}

// Helper function to find new events
function findNewEvents(currentEvents: ForestersEvent[], existingEvents: ForestersEvent[]): ForestersEvent[] {
  const existingEventIds = new Set(existingEvents.map(event => event.eventId));
  return currentEvents.filter(event => !existingEventIds.has(event.eventId));
}

// Helper function to check if an event is expired
function isEventExpired(event: ForestersEvent): boolean {
  const now = new Date();
  const endDate = new Date(event.endDate);
  return endDate < now;
}

// Helper function to filter out expired events
function removeExpiredEvents(events: ForestersEvent[]): ForestersEvent[] {
  const now = new Date();
  return events.filter(event => !isEventExpired(event));
}

// Format event details for email
function formatEventForEmail(event: ForestersEvent): string {
  const eventDate = new Date(event.startDate);
  const formattedDate = eventDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const now = new Date();
  const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Get a clean version of the description (remove HTML tags)
  const cleanDescription = event.description.replace(/<\/?[^>]+(>|$)/g, ' ').trim();

  // Create a shortened description (first 150 characters)
  const shortDescription = cleanDescription.length > 150
    ? cleanDescription.substring(0, 150) + '...'
    : cleanDescription;

  // Build the location string
  const location = [
    event.building.name,
    event.building.addressLine1,
    event.building.city,
    event.building.stateProvince,
    event.building.postalCode
  ].filter(Boolean).join(', ');

  // Enhanced availability display that's mobile-friendly and matches existing design
  let availabilityText = '';
  let availabilityStyle = '';

  if (event.activityFull) {
    availabilityText = 'FULLY BOOKED';
    availabilityStyle = 'color: #e74c3c; font-weight: bold;';
  } else if (event.openSpotsleft <= 3) {
    availabilityText = `ONLY ${event.openSpotsleft} SPOT${event.openSpotsleft === 1 ? '' : 'S'} LEFT!`;
    availabilityStyle = 'color: #f39c12; font-weight: bold;';
  } else {
    availabilityText = `${event.openSpotsleft} spaces available`;
    availabilityStyle = 'color: #27ae60; font-weight: bold;';
  }

  // Build the event HTML with mobile-friendly design that matches the original
  return `
    <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
      <h2 style="color: #2c3e50; margin-top: 0; font-size: 18px; line-height: 1.3;">${event.eventName}</h2>
      
      <p style="color: #7f8c8d; font-size: 14px; line-height: 1.4; margin: 10px 0;">
        <strong>Date:</strong> ${formattedDate} (in ${daysUntil} days)<br>
        <strong>Location:</strong> ${location}<br>
        <strong>Availability:</strong> <span style="${availabilityStyle}">${availabilityText}</span>
      </p>
      
      <p style="margin: 15px 0; font-size: 14px; line-height: 1.4;">${shortDescription}</p>
      
      ${event.image?.eventcardimage ?
      `<img src="${event.image.eventcardimage}" alt="${event.eventName}" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px; display: block;">` :
      ''
    }
      
      <p style="margin-top: 15px; margin-bottom: 0;">
        <a href="https://my.foresters.com" 
           style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px;">
          View Details
        </a>
      </p>
    </div>
  `;
}

// Helper function to send debug/error emails
async function sendDebugEmail(error: Error, context: string): Promise<void> {
  if (EMAIL_CONFIG.debugRecipients.length === 0) {
    console.log('No debug email recipients configured.');
    return;
  }

  // Check if we have mail configuration
  if (!EMAIL_CONFIG.user || !EMAIL_CONFIG.pass) {
    console.log('📧 Debug email would be sent, but SMTP configuration is missing');
    console.error(`Error in ${context}:`, error.message);
    return;
  }

  // Configure the transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_CONFIG.user,
      pass: EMAIL_CONFIG.pass,
    },
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Foresters Scraper Error</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px; 
        }
        .error-box {
          background-color: #ffe6e6;
          border: 2px solid #ff4444;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .error-title {
          color: #cc0000;
          font-weight: bold;
          font-size: 18px;
        }
        .error-details {
          background-color: #f5f5f5;
          border-left: 4px solid #ccc;
          padding: 10px;
          margin: 10px 0;
          font-family: monospace;
          white-space: pre-wrap;
        }
        .timestamp {
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <h1>🚨 Foresters Scraper Error Alert</h1>
      
      <div class="error-box">
        <div class="error-title">Error occurred in: ${context}</div>
        <div class="timestamp">Time: ${new Date().toISOString()}</div>
      </div>
      
      <h3>Error Details:</h3>
      <div class="error-details">${error.message}</div>
      
      <h3>Stack Trace:</h3>
      <div class="error-details">${error.stack || 'No stack trace available'}</div>
      
      <p><strong>Action Required:</strong> Please check the scraper configuration and website changes.</p>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: EMAIL_CONFIG.from || EMAIL_CONFIG.user,
      to: EMAIL_CONFIG.debugRecipients.join(','),
      subject: `🚨 Foresters Scraper Error: ${context}`,
      html: htmlContent,
    });

    console.log(`📧 Debug email sent: ${info.messageId}`);
  } catch (emailError) {
    console.error('Error sending debug email:', emailError);
  }
}

// Helper function to send email about new events
async function sendEventNotification(events: ForestersEvent[]): Promise<void> {
  if (events.length === 0 || EMAIL_CONFIG.recipients.length === 0) {
    console.log('No events to send or no recipients configured.');
    return;
  }

  // Check if we have mail configuration
  if (!EMAIL_CONFIG.user || !EMAIL_CONFIG.pass) {
    console.log('📧 Email would be sent, but SMTP configuration is missing');
    events.forEach(event => {
      console.log(`- ${event.eventName} (${new Date(event.startDate).toLocaleDateString()})`);
    });
    return;
  }

  // Configure the transporter

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_CONFIG.user,
      pass: EMAIL_CONFIG.pass,
    },
  });
  // Generate HTML content for the email
  const eventsHTML = events.map(formatEventForEmail).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Foresters Events</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px; 
        }
        h1 { 
          color: #2c3e50; 
          font-size: 24px;
          margin-bottom: 20px;
        }
        .footer { 
          margin-top: 30px; 
          padding-top: 15px; 
          border-top: 1px solid #eee; 
          font-size: 12px; 
          color: #7f8c8d; 
        }
        @media only screen and (max-width: 600px) {
          body {
            padding: 10px;
          }
          h1 {
            font-size: 20px;
          }
        }
      </style>
    </head>
    <body>
      <h1>New Foresters Events Found!</h1>
      
      <p>We've discovered ${events.length} new event${events.length > 1 ? 's' : ''} that you might be interested in:</p>
      
      ${eventsHTML}
      
      <div class="footer">
        <p>This is an automated notification from your Foresters Events Monitor.</p>
        <p>To stop receiving these emails, please reply with "Unsubscribe" in the subject line.</p>
      </div>
    </body>
    </html>
  `;

  try {
    // Create subject line
    const subject = events.length === 1
      ? `New Foresters Event: ${events[0].eventName}`
      : `${events.length} New Foresters Events Available`;

    // Send the email
    const info = await transporter.sendMail({
      from: EMAIL_CONFIG.from || EMAIL_CONFIG.user,
      to: EMAIL_CONFIG.recipients.join(','),
      subject,
      html: htmlContent,
    });

    console.log(`📧 Email sent: ${info.messageId}`);
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}

// Helper function to check for and click "No thanks" button if it exists
async function checkForNoThanksButton(page: any): Promise<boolean> {
  console.log('Checking for No thanks element...');

  try {
    // Use a more direct approach with page.waitForSelector with a timeout
    // This will wait until either the element is found or the timeout is reached
    console.log('Actively waiting for No thanks element to appear...');

    // Look for anchor tags or buttons containing "no thanks" text (case insensitive)
    const selector = 'a:has-text("No thanks"), a:has-text("no thanks"), button:has-text("No thanks"), button:has-text("no thanks")';

    // Use a short timeout but actively wait
    const element = await page.waitForSelector(selector, {
      state: 'visible',
      timeout: 8000
    }).catch(() => null); // Return null if not found within timeout

    // If element found, click it
    if (element) {
      console.log('⚠️ Found "No thanks" element - clicking it');
      await element.click();
      // Wait a moment to ensure the click is processed
      await page.waitForTimeout(500);
      return true;
    } else {
      console.log('No "No thanks" element found after active waiting');
      return false;
    }
  } catch (error) {
    console.log('Error while checking for No thanks element:', error);
    return false;
  }
}

test('Login and fetch events via API, store and find new ones', async ({ page, context }) => {
  try {
    // Validate required credentials
    if (!LOGIN_CREDENTIALS.username || !LOGIN_CREDENTIALS.password) {
      const error = new Error('Foresters login credentials not found in environment variables. Please set FORESTERS_USERNAME and FORESTERS_PASSWORD environment variables.');
      console.error('ERROR:', error.message);
      await sendDebugEmail(error, 'Credential Validation');
      throw error;
    }

    let bearerToken = '';

    // Capture the bearer token from network traffic
    context.on('request', request => {
      const url = request.url();
      const auth = request.headers()['authorization'];
      if (url.includes('api-myevents.foresters.com') && auth?.startsWith('Bearer')) {
        bearerToken = auth;
        console.log('✅ Captured Bearer Token:', bearerToken);
      }
    });

    // Login to the Foresters website
    console.log('🔑 Logging in to Foresters website...');
    await page.goto('https://my.foresters.com/en-gb/login');
    await page.getByRole('button', { name: 'Accept all' }).click();
    await page.getByRole('textbox', { name: 'Username' }).click();
    await page.getByRole('textbox', { name: 'Username' }).fill(LOGIN_CREDENTIALS.username);
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill(LOGIN_CREDENTIALS.password);
    await page.getByRole('button', { name: 'Log in' }).click();

    // Wait for login to complete
    console.log('⏳ Waiting for login to complete...');
    await page.waitForTimeout(5000);

    // Check for No thanks button after login - this is the only place we need it
    await checkForNoThanksButton(page);

    // Complete waiting
    await page.waitForTimeout(5000);

    // Navigate to events page
    console.log('🧭 Navigating to events page...');
    await checkForNoThanksButton(page);
    await page.getByRole('link', { name: 'Grants' }).click();
    await page.locator('#menuItemFullContent2').getByRole('link', { name: 'Member activities' }).click();
    await page.getByRole('link', { name: 'Find an Activity' }).first().click();

    const page1 = await page.waitForEvent('popup');

    // Wait and give time for the token to be captured
    console.log('⏳ Waiting for token capture...');
    await page1.waitForTimeout(15000);

    // Use the captured Bearer token to call the API
    if (!bearerToken) {
      const error = new Error('Bearer token not captured. Ensure the Find an Activity popup triggers the API request.');
      console.error('ERROR:', error.message);
      await sendDebugEmail(error, 'Token Capture');
      throw error;
    }

    console.log('🔍 Searching for events with parameters:', SEARCH_PARAMS);
    const eventApiUrl = 'https://api-myevents.foresters.com/api/events/publishedEventbyradius';
    const requestBody = {
      "radius": SEARCH_PARAMS.radius,
      "zipcode": SEARCH_PARAMS.zipcode,
      "countryCode": SEARCH_PARAMS.countryCode,
      "IsVirtual": false,
      "OpenSpot": false,
      "byLocation": "United Kingdom",
      "DistanceUnit": "",
      "branchNumber": "5006",
      "crmContactId": "4adf4e61-85a8-ed11-aacf-000d3a09c72f",
      "filterflag": true
    };

    console.log('🌐 Calling API to fetch events...');
    let response;
    try {
      response = await axios.post(eventApiUrl, requestBody, {
        headers: {
          Authorization: bearerToken,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      });
    } catch (apiError) {
      const error = new Error(`API request failed: ${apiError.message}`);
      console.error('ERROR:', error.message);
      await sendDebugEmail(error, 'API Request');
      throw error;
    }

    // Get the current events from the API response
    const currentEvents = response.data as ForestersEvent[];
    console.log(`📊 Found ${currentEvents.length} events from API`);

    // Filter out expired events from the API response
    const activeCurrentEvents = removeExpiredEvents(currentEvents);
    console.log(`🗓️ ${activeCurrentEvents.length} active events, ${currentEvents.length - activeCurrentEvents.length} expired events filtered out`);

    // Load existing events from file
    const existingData = loadExistingEvents();

    // Remove expired events from stored events
    const activeExistingEvents = removeExpiredEvents(existingData.events);
    console.log(`🧹 Removed ${existingData.events.length - activeExistingEvents.length} expired events from storage`);

    // Find new events (comparing only with active existing events)
    const newEvents = findNewEvents(activeCurrentEvents, activeExistingEvents);

    if (newEvents.length > 0) {
      console.log(`🎉 Found ${newEvents.length} NEW events!`);

      // Take a screenshot of the new events page if possible
      try {
        await page1.screenshot({ path: 'new-events-found.png' });
        console.log('📸 Screenshot saved to new-events-found.png');
      } catch (e) {
        console.log('Could not take screenshot');
      }

      // Send notification about new events
      await sendEventNotification(newEvents);

      // Save the updated events data (only including active events)
      const updatedEventsData: EventsData = {
        lastUpdated: new Date().toISOString(),
        events: [...activeExistingEvents, ...newEvents]
      };

      saveEvents(updatedEventsData);
    } else {
      console.log('No new events found');

      // Still update storage to remove expired events
      if (existingData.events.length !== activeExistingEvents.length) {
        const cleanedEventsData: EventsData = {
          lastUpdated: new Date().toISOString(),
          events: activeExistingEvents
        };
        saveEvents(cleanedEventsData);
      } else {
        // Just update the timestamp
        existingData.lastUpdated = new Date().toISOString();
        saveEvents(existingData);
      }
    }

    // Add summary section
    console.log('\n📊 EVENT SUMMARY:');
    console.log(`Total events from API: ${currentEvents.length}`);
    console.log(`Active events: ${activeCurrentEvents.length}`);
    console.log(`Expired events: ${currentEvents.length - activeCurrentEvents.length}`);
    console.log(`New events found: ${newEvents.length}`);
    console.log(`Events in storage after update: ${activeExistingEvents.length + newEvents.length}`);

    // Log all active event names for verification
    console.log('\n📋 Active Events:');
    activeCurrentEvents.forEach((event, index) => {
      // Calculate days until event
      const now = new Date();
      const eventDate = new Date(event.startDate);
      const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const spotsStatus = event.activityFull ? '❌ FULL' : `✅ ${event.openSpotsleft} spots left`;

      console.log(`${index + 1}. ${event.building.city} |  ${event.eventName} - ${new Date(event.startDate).toLocaleDateString()} (in ${daysUntil} days) - ${spotsStatus}`);
    });

  } catch (error) {
    console.error('🚨 Fatal error occurred:', error.message);
    await sendDebugEmail(error as Error, 'Main Process');
    throw error;
  }
});
