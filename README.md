# Foresters Events Monitor

A Playwright-based web scraper that monitors the Foresters website for new events and sends email notifications when new events are found.

## Features

- Automated login to Foresters website
- Event data extraction via API interception
- **Enhanced email notifications** with clear availability indicators:
  - 🟢 Green badges for available events
  - 🟠 Orange badges for low availability (≤3 spots)
  - 🔴 Red badges for fully booked events
- **Debug email notifications** for errors and issues
- Persistent storage of event data
- Automatic removal of expired events
- Docker support for deployment

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

4. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

5. Update the `.env` file with your credentials:
   - `FORESTERS_USERNAME`: Your Foresters login username
   - `FORESTERS_PASSWORD`: Your Foresters login password
   - `EMAIL_USER`: Gmail address for sending notifications
   - `GOOGLE_APP_PASSWORD`: Gmail app password (not your regular password)
   - `EMAIL_FROM`: Email address to send from
   - `EMAIL_RECIPIENTS`: Comma-separated list of recipients

## Usage

### Local Development

Run the test manually:
```bash
npm test
```

### Docker Deployment

Build the Docker image:
```bash
docker build -t foresters-scraper .
```

Run the container:
```bash
docker run --env-file .env foresters-scraper
```

### Scheduled Execution

For production use, you can schedule the scraper to run periodically using:
- GitHub Actions (with scheduled workflows)
- Cron jobs on a server
- Cloud Functions with timers
- Vercel Cron Jobs

## Configuration

Environment variables available:

- `FORESTERS_USERNAME`: Required - Foresters login username
- `FORESTERS_PASSWORD`: Required - Foresters login password
- `EMAIL_USER`: Gmail address for sending notifications
- `GOOGLE_APP_PASSWORD`: Gmail app password
- `EMAIL_FROM`: Email address to send from
- `EMAIL_RECIPIENTS`: Comma-separated list of email recipients
- `DEBUG_EMAIL_RECIPIENTS`: Comma-separated list of recipients for error notifications (optional)
- `SEARCH_RADIUS`: Search radius for events (default: "0")
- `SEARCH_ZIPCODE`: Search postcode (default: "NP44 6EP")
- `SEARCH_COUNTRY_CODE`: Country code (default: "GB")

## How It Works

1. The scraper logs into the Foresters website using provided credentials
2. Navigates to the "Find an Activity" page
3. Intercepts API calls to capture authentication tokens
4. Uses the captured token to directly call the events API
5. Compares new events with previously stored events
6. Sends email notifications for any new events found
7. Updates the local storage with current event data
8. Automatically removes expired events from storage

## Data Storage

Events are stored in `data/foresters-events.json` with the following structure:
- `lastUpdated`: Timestamp of last check
- `events`: Array of event objects

## Email Notifications

Email notifications include:
- Event name and description
- Date and location
- Availability status
- Event image (if available)
- Direct link to Foresters website

## Troubleshooting

1. **Login Issues**: Verify your Foresters credentials
2. **Email Issues**: Ensure you're using a Gmail app password, not your regular password
3. **No Events Found**: Check your search parameters (radius, postcode, country)
4. **Token Capture Failed**: The website structure may have changed; check the navigation steps

## License

ISC

