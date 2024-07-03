import ICAL from "https://unpkg.com/ical.js@2.0.1/dist/ical.js";

let data; // ical parse full

function main() {
    const submitICal = document.getElementById("submit-ical");
    addOnClick(submitICal, onICalSubmit);
}
main();

async function onICalSubmit() {
    // reset error msg/fieldset
    const errorText = document.getElementById("error-text");
    errorText.textContent = "";
    const holidaysField = document.getElementById("holidays-field");
    holidaysField.style.display = "none";
    
    // parse ical file
    const fileInput = document.getElementById("file-input");
    const file = fileInput.files[0];
    if (!file) {
        errorText.textContent = "No file selected!";
        return;
    }
    const ical = await file.text();

    try {
        data = ICAL.parse(ical);
    } catch (e) {
        errorText.textContent = "Invalid iCal file/format.";
        console.log(e);
        return;
    }
    //console.log(data);
    const events = data[2];

    //console.log(events);
    showHolidayFieldset(events);
}

// and add onclick to submit-holidays
function showHolidayFieldset(events) {
    const holidaysField = document.getElementById("holidays-field");
    holidaysField.style.display = "inline-block";

    const holidayDivs = document.getElementById("holiday-divs");
    holidayDivs.innerHTML = "";

    // add onclick to top and bottom
    const submitHolidaysTop = document.getElementById("submit-holidays-top");
    addOnClick(submitHolidaysTop, () => onHolidaysSubmit(events));
    submitHolidaysTop.style.display = "block";
    const submitHolidaysBottom = document.getElementById("submit-holidays-bottom");
    addOnClick(submitHolidaysBottom, () => onHolidaysSubmit(events));
    submitHolidaysBottom.style.display = "block";

    // add holidays to fieldset
    const uniqueHolidays = getUniqueHolidays(events);
    uniqueHolidays.forEach(holidayName => {
        addHolidayToPage(holidayName);
    });
}

function onHolidaysSubmit(events) {
    const checkedHolidayEvents = getCheckedHolidays(events);
    const str = arrayToString(checkedHolidayEvents);

    const selectedHolidaysTooltip = document.getElementById("selected-holidays-tooltip");
    selectedHolidaysTooltip.style = "font-size: larger;";

    const selectedHolidaysP = document.getElementById("selected-holidays");
    selectedHolidaysP.textContent = str;
    window.scrollTo(0, document.body.scrollHeight);
}

function addOnClick(element, callback) {
    if (document.readyState === "complete") {
        element.onclick = callback;
    } else {
        document.addEventListener("DOMContentLoaded", () => element.onclick = callback);
    }
}

function getUniqueHolidays(events) {
    const allHolidays = [];
    let uniqueHolidays;

    try {
        // get all holiday names
        for (let i = 0; i < events.length; i++) {
            const name = events[i][1][10][3];
            allHolidays[i] = name;
        }

        // filter unique
        uniqueHolidays = allHolidays.filter((value, index, self) => self.indexOf(value) === index);
        uniqueHolidays.sort();
    } catch (e) {
        console.log(e);
    }

    return uniqueHolidays;
}

function arrayToString(array) {
    let str = "";
    str += "[";
    array.forEach(holiday => {
        str += "\"" + holiday + "\", ";
    });
    if (str.length > 1) 
        str = str.slice(0, -2);
    str += "]";
    return str;
}

function addHolidayToPage(holidayName) {
    const div = document.createElement("div");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = holidayName;
    
    const label = document.createElement("label");
    label.setAttribute("for", holidayName);
    label.textContent = holidayName;

    div.appendChild(checkbox);
    div.appendChild(label);

    const parent = document.getElementById("holiday-divs")
    parent.appendChild(div);
}

// this is used in getCheckedHolidayEvents
function getCheckedHolidays() {
    const checked = document.querySelectorAll('input[type="checkbox"]:checked');
    const checkedHolidays = [];
    checked.forEach(item => {
        checkedHolidays.push(item.id);
    });
    //console.log(checkedHolidays);
    return checkedHolidays;
}