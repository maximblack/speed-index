import fs from 'fs';
import path from 'path';
import { remote } from 'webdriverio';
import speedline from 'speedline';

const URL = 'http://habrahabr.ru';

// For the babel-node
process.on('unhandledRejection', function(err){
    console.log(err.stack);
    process.exit(1);
});

/*speedline('./timeline.json').then(results => {
    console.log('Speed Index value:', results.speedIndex);
});*/

const STATE_SUCCESS = 'success';

const appDirectory = fs.realpathSync(process.cwd());
function resolveApp(relativePath) {
    return path.resolve(appDirectory, relativePath);
}

const options = {
    desiredCapabilities: {
        browserName: 'chrome',
        chromeOptions: {
            perfLoggingPrefs: {
                traceCategories: ',blink.console,disabled-by-default-devtools.timeline,benchmark',
            },
            args: [
                '--enable-gpu-benchmarking',
                '--enable-thread-composting'
            ],
        },
        loggingPrefs: {
            performance: 'ALL',
        }
    },
};

const browser = remote(options);

browser
    .init()
    .url(URL)
    .then(() => {
        console.log('Flushing timeline data before we start collecting it for real');
        return browser.log('performance');
    })
    .then(() => {
        console.log('Sending the scroll function to the browser and executing it');
        return browser.execute('(' + scroll.toString() + ')()');
    })
    .then(function() {
        console.log('Wait for scroll to finish. When it finishes, it sets the __scrollComplete__ to true');
        return browser.waitUntil(
            function() {
                return this.execute('return window.__scrollComplete__ === true').then((res) => { return res.value; });
            },
            10000, //5000 // Timeout
            'Scroll timeout reached', // Timeout message
            1000//1000 * 60 * 10 // Interval
        );
        /*browser.waitFor({
            asserter: wd.asserters.jsCondition('(window.__scrollComplete__ === true)', false),
            timeout: 1000 * 60 * 10,
            pollFreq: 2000,
        });*/
    })
    .then(() => {
        console.log('Getting actual timeline data - this will take a while');
        return browser.log('performance');
    })
    .then(function(data) {
        const sessionId = data.sessionId;
        const hCode = data.hCode;

        if(data.state === STATE_SUCCESS) {

            const filePath = resolveApp(`timelines/${sessionId}.json`);

            // Transform into json
            const json = JSON.stringify(data.value.map(function(record) {
                return JSON.parse(record.message).message;
            }));

            console.log(`Saving timeline data to a file '${filePath}'`);

            // Write to file by sessionId
            fs.writeFileSync(filePath, json);

            console.log('Saved');

        }
    })
    /*.getTitle()
    .then(function(title) {
        console.log('Title was: ' + title);
    })*/
    .end();

// This function scrolls the page. Calling this function from the browser dev tools console should also scroll the pgae
const scroll = function() {
    window.chrome.gpuBenchmarking.smoothScrollBy(5000, function() {
        window.__scrollComplete__ = true;
    }, 0, 0, chrome.gpuBenchmarking.DEFAULT_INPUT, 'down', 800);
};

const isScrollDone = function() {
    return window.__scrollComplete__ === true;
};