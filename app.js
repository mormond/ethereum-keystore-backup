var file_system = require('fs');
var archiver = require('archiver');
var os = require("os");
var path = require("path");
var fs = require("fs");

var homePath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
var keystorePath = process.env.KEYSTORE_PATH || path.join(homePath, '.geth', 'keystore');
var backupIntervalInSec = process.env.BACKUP_INTERVAL_SEC || 10;
var backupIntervalInMilliseconds = backupIntervalInSec * 1000;
var archivesPath = process.env.ARCHIVE_PATH || 'archives';

// Ensure archive directory exists
if (!fs.existsSync(archivesPath)) {
    fs.mkdirSync(archivesPath);
}

// Zip up a source directory and store in a specific directory
function zipDirectory(dirToZip, zipFileName) {
    var outputDestination = path.join(archivesPath, zipFileName);
    console.log("Creating new archive of " + dirToZip + " at location " + outputDestination);
    var output = file_system.createWriteStream(outputDestination);
    var archive = archiver('zip', {
        store: true
    });

    output.on('close', function () {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');
    });

    archive.on('error', function(err){
        throw err;
    });

    archive.pipe(output);
    archive.directory(dirToZip);
    archive.finalize();
    return outputDestination;
}

// Generate unique names for each zip archive
function generateZipFileName() {
    var date = new Date();
    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;
    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;
    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;
    var hostname = os.hostname();
    return hostname + "_" + year + "_" + month + "_" + day + "_" + hour + "_" + min + "_" + sec + ".zip";
}

// Send archive file to a remote storage location for safe keeping
function backupArchive(archiveToBackupPath) {
    console.log("Sending " + archiveToBackupPath + " to remote backup store");
}

// Periodically backup local keystore
setInterval(function() {
    var zipPath = zipDirectory(keystorePath, generateZipFileName());
    backupArchive(zipPath);
}, backupIntervalInMilliseconds)
