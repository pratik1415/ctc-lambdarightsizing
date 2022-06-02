'use strict';

const aws = require('aws-sdk');

/**
 * 
 * @param {Object} csvData 
 * @param {String} fileName 
 * @param {Object} tempCredentials
 * @returns s3 file path
 */
 //***********************************************
const putCsvFileToS3 = async ( keys,csv, tempCredentials) => {
const s3 = new aws.S3(tempCredentials)
var keyName = `OversizedMemoryFunctionDetails/${keys}_oversizedMemoryFunctionDetails.csv`;
var params = {
    Body: csv,
    Bucket: 'bms-devops',
    Key: keyName
};
    console.info('params for s3', params);
    try {
        const res = await s3.putObject(params).promise();
        console.log('Email csv file inserted successfully');
        const filePath = "https://s3.amazonaws.com/" + params.Bucket + "/" + keyName
        return filePath;
    } catch (error) {
        console.log('error', error);
        throw error;
    }
};

module.exports = {
    putCsvFileToS3
};