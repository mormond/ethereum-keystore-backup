var file_system = require('fs');
var archiver = require('archiver');
var os = require("os");
var path = require("path");
var fs = require("fs");
var azure = require('azure-storage');

var _environment = process.env.BACKUP_ENVIRONMENT || 'development';
var _homePath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
var _keystorePath = process.env.KEYSTORE_PATH || path.join(_homePath, '.geth', 'keystore');
var _backupIntervalInSec = process.env.BACKUP_INTERVAL_SEC || 10;
var _backupIntervalInMilliseconds = _backupIntervalInSec * 1000;
var _archivesPath = process.env.ARCHIVE_PATH || '.archives';
var _hostname = os.hostname();

if(_environment == 'development') {
    console.log("Development Environment");
    console.log("----------------------");
    console.log("Keystore path: " + _keystorePath);
    console.log("Interval (secs): " + _backupIntervalInSec);
    console.log("Archive path: " + _archivesPath);
    console.log("AZURE_STORAGE_ACCESS_KEY: " + process.env.AZURE_STORAGE_ACCESS_KEY);
    console.log("AZURE_STORAGE_ACCOUNT: " + process.env.AZURE_STORAGE_ACCOUNT);
    console.log("AZURE_STORAGE_CONNECTION_STRING: " + process.env.AZURE_STORAGE_CONNECTION_STRING);   
    console.log("----------------------");
}

// Zip up a source directory and store in a specific directory
function zipDirectory(directoryToZip, zipFileName) {
    var outputDestination = path.join(_archivesPath, zipFileName);
    console.log("Creating new archive of " + directoryToZip + " at location " + outputDestination);

    var output = file_system.createWriteStream(outputDestination);
    var archive = archiver('zip', {
        store: true
    });

    output.on('close', function () {
        console.log(archive.pointer() + ' total bytes');
        console.log('Archiver has been finalized and the output file descriptor has closed.');
    });

    archive.on('error', function(err){
        throw err;
    });

    archive.pipe(output);
    archive.directory(directoryToZip);
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
    return _hostname + "_" + year + month + day + hour + min + sec + ".zip";
}

// Send archive file to a remote storage location for safe keeping
function backupArchive(archiveBackupPath, archiveFile) {
    console.log("Uploading " + archiveBackupPath + " to Azure Blob Storage.");
    
    blobService.createBlockBlobFromLocalFile('keystorebackup', archiveFile, archiveBackupPath, function(error, result, response) {
        if (!error) {
            console.log("Successfully backed up archive to Azure Blob Storage");
            console.log(result)
        } else {
            throw(error)
        }
    });
}

// Ensure required variables are set
if((process.env.AZURE_STORAGE_ACCESS_KEY && process.env.AZURE_STORAGE_ACCOUNT) || process.env.AZURE_STORAGE_CONNECTION_STRING) {
    // Pass
} else {
    throw("Please set the following environment variables: AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY, or AZURE_STORAGE_CONNECTION_STRING.");
}

// Ensure local archive directory exists
if (!fs.existsSync(_keystorePath)) {
    throw("There is no keystore to backup!");
}

// Ensure local archive directory exists
if (!fs.existsSync(_archivesPath)) {
    fs.mkdirSync(_archivesPath);
}

// Ensure remote archive container exists
var blobService = azure.createBlobService();
blobService.createContainerIfNotExists('keystorebackup', {
  publicAccessLevel: 'blob'
}, function(error, result, response) {
  if (!error) {
      if(result) {
          console.log("Azure container created successfully");
      } else {
          console.log("Azure container already exists");
      }
  } else {
      throw(error);
  }
});

// Periodically backup local keystore
setInterval(function() {
    var uniqueZipFileName = generateZipFileName();
    var zipPath = zipDirectory(_keystorePath, uniqueZipFileName);
    backupArchive(zipPath, uniqueZipFileName);
}, _backupIntervalInMilliseconds)
