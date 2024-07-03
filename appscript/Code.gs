/*
*=========================================
*       INSTALLATION INSTRUCTIONS
*=========================================
* 
* 1) Make a copy of this script:
*      Go to the project overview icon on the left (looks like this: ⓘ), then click the "copy" icon at the top right (looks like two files on top of each other).
*      Use this copy from now on to edit and change settings.
* 2) Settings: 
*      See the 3 options in the Settings section below (lines 34, 38, and 42) and change the values *after* the equal sign as necessary. Please read their respective directions carefully.
* 3) Install:
*      Make sure your toolbar says "install" to the right of "Debug", then click "Run".
* 4) Authorize: 
*      You will be prompted to authorize the program and will need to click "Advanced" > "Go to specific-holidays-gcal (unsafe)".
*      These permissions are needed to 1) create and import a calendar into your Google Calendar, 2) periodically update the calendar to include upcoming holidays,
*      and 3) get calendar information from the ICAL_LINK provided.
*
* * It may take a few minutes for the events to populate into your Calendar.
*
* * You can also run "startSync" if you don't want holidays to auto-update (change the dropdown to the right of "Debug" from "install" to "startSync").
* * If you would like to select specific holidays for another calendar, duplicate this script, change the settings, and install it.
* * To stop auto-updates, change the dropdown to the right of "Debug" from "install" to "uninstall", and Run.
*
*=========================================
*               SETTINGS
*=========================================
*/

// These are the default values. Change them as needed.

// Go to Google Calendar (website) settings > "Add calendar" > "Browse calendars of interest" > "Regional holidays" > Browse and select a calendar.
// Select the added calendar under "Settings for other calendars" > "Integrate calendar" > Copy the entire link in "Public address in iCal format".
// The format should be: "https://calendar.google.com/calendar/ical/......ics". It should end in ".ics".
const ICAL_LINK = "https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics";

// Using the link above, use https://projects.char.kim/specific-holidays-gcal to easily select specific holidays you want and skip to step 3.
// The format should be: ["name1"] OR ["name1", "name2", "name3"] ...etc
const SPECIFIC_HOLIDAYS = ["New Year's Day"];

// What the calendar will be named
// The format should be: "calendar name here"
const CALENDAR_NAME = "specific-holidays-gcal";

/*
*=========================================
*     About specific-holidays-gcal
*=========================================
*
* specific-holidays-gcal is a slightly edited version of GAS-ICS-Sync.
*
* Source code: https://github.com/charleskimbac/specific-holidays-gcal
*
*=========================================
*          About GAS-ICS-Sync
*=========================================
*
* GAS-ICS-Sync was created by Derek Antrican.
*
* Contributors and source code: https://github.com/derekantrican/GAS-ICS-Sync
*
*=========================================
*/

//=====================================================================================================
//!!!!!!!!!!!!!!!! DO NOT EDIT BELOW HERE UNLESS YOU REALLY KNOW WHAT YOU'RE DOING !!!!!!!!!!!!!!!!!!!!
//=====================================================================================================

var howFrequent = 1;                   // What interval (weeks) to run this script on to check for new events
var onlyFutureEvents = false;          // If you turn this to "true", past events will not be synced (this will also removed past events from the target calendar if removeEventsFromCalendar is true)
var addEventsToCalendar = true;        // If you turn this to "false", you can check the log (View > Logs) to make sure your events are being read correctly before turning this on
var modifyExistingEvents = true;       // If you turn this to "false", any event in the feed that was modified after being added to the calendar will not update
var removeEventsFromCalendar = true;   // If you turn this to "true", any event not found in the feed will be removed. CHANGED TO FALSE AFTER THE FIRST RUN IN LINE 217 TO KEEP OLDER HOLIDAYS.
var addAlerts = "default";             // Whether to add the ics/ical alerts as notifications on the Google Calendar events or revert to the calendar's default reminders ("yes", "no", "default").
var addOrganizerToTitle = false;       // Whether to prefix the event name with the event organiser for further clarity
var descriptionAsTitles = false;       // Whether to use the ics/ical descriptions as titles (true) or to use the normal titles as titles (false)
var addCalToTitle = false;             // Whether to add the source calendar to title
var addAttendees = false;              // Whether to add the attendee list. If true, duplicate events will be automatically added to the attendees' calendar.
var defaultAllDayReminder = -1;        // Default reminder for all day events in minutes before the day of the event (-1 = no reminder, the value has to be between 0 and 40320)
var overrideVisibility = "";           // Changes the visibility of the event ("default", "public", "private", "confidential"). Anything else will revert to the class value of the ICAL event.
var addTasks = false;

//=====================================================================================================

var emailSummary = false;
var email = "";
var defaultMaxRetries = 10; // Maximum number of retries for api functions (with exponential backoff)
var sourceCalendars = [[CALENDAR_NAME]];

function install(){
  //Delete any already existing triggers so we don't create excessive triggers
  deleteAllTriggers();

  //Schedule sync routine to explicitly repeat and schedule the initial sync
  ScriptApp.newTrigger("startSync").timeBased().everyWeeks(howFrequent).onWeekDay(ScriptApp.WeekDay.SUNDAY).create();
  ScriptApp.newTrigger("startSync").timeBased().after(1000).create();

  Logger.log("Done! It may take a few minutes for the calendar to show up in Google Calendar.")
}

function uninstall(){
  deleteAllTriggers();
}

var startUpdateTime;

// Per-calendar global variables (must be reset before processing each new calendar!)
var calendarEvents = [];
var calendarEventsIds = [];
var icsEventsIds = [];
var calendarEventsMD5s = [];
var recurringEvents = [];
var targetCalendarId;
var targetCalendarName;

// Per-session global variables (must NOT be reset before processing each new calendar!)
var addedEvents = [];
var modifiedEvents = [];
var removedEvents = [];

function startSync(){
  /*
  if (PropertiesService.getUserProperties().getProperty('LastRun') > 0 && (new Date().getTime() - PropertiesService.getUserProperties().getProperty('LastRun')) < 360000) {
    Logger.log("Another iteration is currently running! Exiting...");
    return;
  }
  */
  PropertiesService.getUserProperties().setProperty('LastRun', new Date().getTime());
  
  if (onlyFutureEvents)
    startUpdateTime = new ICAL.Time.fromJSDate(new Date());
  
  //Disable email notification if no mail adress is provided 
  emailSummary = emailSummary && email != "";
  
  console.log(sourceCalendars);
  for (var calendar of sourceCalendars){
    //------------------------ Reset globals ------------------------
    calendarEvents = [];
    calendarEventsIds = [];
    icsEventsIds = [];
    calendarEventsMD5s = [];
    recurringEvents = [];

    targetCalendarName = calendar[0];
    var vevents;

    //------------------------ Fetch URL items ------------------------
    var responses = getSpecificHolidaysICal();
    Logger.log("Syncing " + responses.length + " calendars to " + targetCalendarName);
    
    //------------------------ Get target calendar information------------------------
    var targetCalendar = setupTargetCalendar(targetCalendarName);
    targetCalendarId = targetCalendar.id;
    Logger.log("Working on calendar: " + targetCalendarId);
    
    //------------------------ Parse existing events --------------------------
    if(addEventsToCalendar || modifyExistingEvents || removeEventsFromCalendar){
      var eventList =
        callWithBackoff(function(){
            return Calendar.Events.list(targetCalendarId, {showDeleted: false, privateExtendedProperty: "fromGAS=true", maxResults: 2500});
        }, defaultMaxRetries);
      calendarEvents = [].concat(calendarEvents, eventList.items);
      //loop until we received all events
      while(typeof eventList.nextPageToken !== 'undefined'){
        eventList = callWithBackoff(function(){
          return Calendar.Events.list(targetCalendarId, {showDeleted: false, privateExtendedProperty: "fromGAS=true", maxResults: 2500, pageToken: eventList.nextPageToken});
        }, defaultMaxRetries);

        if (eventList != null)
          calendarEvents = [].concat(calendarEvents, eventList.items);
      }
      Logger.log("Fetched " + calendarEvents.length + " existing events from " + targetCalendarName);
      for (var i = 0; i < calendarEvents.length; i++){
        if (calendarEvents[i].extendedProperties != null){
          calendarEventsIds[i] = calendarEvents[i].extendedProperties.private["rec-id"] || calendarEvents[i].extendedProperties.private["id"];
          calendarEventsMD5s[i] = calendarEvents[i].extendedProperties.private["MD5"];
        }
      }

      //------------------------ Parse ical events --------------------------
      vevents = parseResponses(responses, icsEventsIds);
      Logger.log("Parsed " + vevents.length + " events from ical sources");
    }
    
    //------------------------ Process ical events ------------------------
    if (addEventsToCalendar || modifyExistingEvents){
      Logger.log("Processing " + vevents.length + " events");
      var calendarTz =
        callWithBackoff(function(){
          return Calendar.Settings.get("timezone").value;
        }, defaultMaxRetries);
      
      vevents.forEach(function(e){
        processEvent(e, calendarTz);
      });

      Logger.log("Done processing events");
    }
    
    //------------------------ Remove old events from calendar ------------------------
    if(removeEventsFromCalendar){
      Logger.log("Checking " + calendarEvents.length + " events for removal");
      processEventCleanup();
      Logger.log("Done checking events for removal");
    }

    //------------------------ Process Tasks ------------------------
    if (addTasks){
      processTasks(responses);
    }

    //------------------------ Add Recurring Event Instances ------------------------
    Logger.log("Processing " + recurringEvents.length + " Recurrence Instances!");
    for (var recEvent of recurringEvents){
      processEventInstance(recEvent);
    }
  }

  if ((addedEvents.length + modifiedEvents.length + removedEvents.length) > 0 && emailSummary){
    sendSummary();
  }

  removeEventsFromCalendar = false; 

  Logger.log("Sync finished!");
  PropertiesService.getUserProperties().setProperty('LastRun', 0);
}