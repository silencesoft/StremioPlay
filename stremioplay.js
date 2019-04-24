#!/usr/bin/env node

'use strict';

const request = require('request'),
    validUrl = require('valid-url'),
    os  = require('os'),
    config = require('./config.json');

const server = 'http://127.0.0.1:11470/';

let videoTitle = '',
    videoImage = '',
    videoSrt = '',
    videoStream = '',
    videoUrl = '',
    videoHash = '';

const app = {
    init: function() {
        const casting = server + 'casting/vlc/player';

        console.info('Starting.');
        console.info(this.getIPAddress());

        request.get(casting, this.processData.bind(this));
    },
    // Get current IP Address
    // From: https://stackoverflow.com/a/15075395
    // By: jhurliman - https://stackoverflow.com/users/248412/jhurliman
    getIPAddress: function() {
        var interfaces = os.networkInterfaces();
        for (var devName in interfaces) {
          var iface = interfaces[devName];
      
          for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
              return alias.address;
          }
        }
      
        return '0.0.0.0';
    },
    // Request Promise
    doRequest: function(url) {
        return new Promise(resolve => {
            request(url, function(err, response, body) {
            resolve(body);
            });
        });
    },
    // Set Information
    setInformation: function(err, response, body) {
        if (err) throw err;
        const data = JSON.parse(body);

        videoTitle = data[videoHash] && data[videoHash].name || '';

        this.getQuality().then((quality) => {
            let url;

            videoStream = quality === '0' ? '' : videoUrl + '/stream-q-' + quality + '.m3u8';
            
            console.info({videoUrl, videoHash, videoTitle, videoStream, videoImage, videoSrt});

            if (videoStream) {
                url = "http://" + config.stremioUrl + ":8060/launch/287269?version=1" + "&url=" + encodeURIComponent(videoStream) + "&title=" + encodeURIComponent(videoTitle) + "&image=" + encodeURIComponent(videoImage) + "&srt=" + encodeURIComponent(videoSrt) + '&custom=' + config.custom;

                if (videoUrl) {
                    request.post(url, this.checkError);
                } else {
                    console.info('No video.');
                }
            }
        });
    },
    // Process data
    processData: function(err, response, body) {
        if (err) throw err;
        const stats = server + 'stats.json',
            data = JSON.parse(body);

        let url;
    
        videoSrt = server.replace('127.0.0.1', this.getIPAddress()) + 'subtitles.srt?offset=' + data.subtitlesDelay + '&from=' + encodeURI(data.subtitlesSrc);
        videoUrl = data.source && data.source.replace('127.0.0.1', this.getIPAddress());
        videoImage = videoUrl + '/thumb.jpg';
        url = videoUrl && videoUrl.split('/');
        videoHash = url && url[url.length-2];

        request.get(stats, this.setInformation.bind(this));
    },
    // check Roku error
    checkError: function(err, response, body){
        if (err) throw err;

        console.info('Video ready.');
    },
    getQuality: function() {
        const url = `${videoUrl}/stream-q-1080.m3u8`;

        return new Promise((resolve, reject) => {
            Promise.all([
                this.doRequest(url),
                this.doRequest(url.replace('1080', '720')),
                this.doRequest(url.replace('1080', '480')),
                this.doRequest(url.replace('1080', '320')),
            ]).then(responses => {
                if (responses[0] !== 'no such quality') {
                    resolve('1080');
                } else if (responses[1] !== 'no such quality') {
                    resolve('720');
                } else if (responses[2] !== 'no such quality') {
                    resolve('480');
                } else if (responses[3] !== 'no such quality') {
                    resolve('320');
                } else {
                    resolve('0');
                }
            })
            .catch(error => {
                throw(error);
            });
        });
    },
}

app.init();
    
module.exports = app;