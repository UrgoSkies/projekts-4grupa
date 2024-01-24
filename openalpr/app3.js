// Required modules
const amqplib = require('amqplib');
const Minio = require('minio');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
console.log(`ist working`);



// Minio settings
const minioClient = new Minio.Client({
    endPoint: 'minio',
    port: 9000,
    useSSL: false,
    accessKey: 'admin123',
    secretKey: 'admin123'
});


// Rabbit connection settings
const amqpUrl = 'amqp://rabbitmq';
const queueName = 'fileQueue';


// Function to process the image
// Logic to get the object from Minio, save it temporarily and process it
async function processImage(filename) {
  const dataStream = await minioClient.getObject('app1', filename);
  const tempDir = path.join(__dirname, 'temp');
  fs.mkdirSync(tempDir, { recursive: true });
  const tempFilePath = path.join(tempDir, filename);

  const fileStream = fs.createWriteStream(tempFilePath);
  dataStream.pipe(fileStream);

  fileStream.on('finish', () => {
    exec(`alpr -c eu -n 1 -j ${tempFilePath}`, async (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error}`);
        return;
      }
      console.log(`OpenALPR: ${stdout}`);
    
      // alpr json read
      const result = JSON.parse(stdout);
      const plate = result.results[0].plate; // get plate nr
      const currentTime = new Date(); // get time
      saveResultToMongoDB(plate, currentTime).catch(console.error);
  
      // delete minio 
      try {
        await minioClient.removeObject('app1', filename);
        console.log(` ${filename} deleted from Minio`);
      } catch (err) {
        console.error(`Error  while deleting file: ${err}`);
      }
    });
  });
}


// Function to consume messages from RabbitMQ
// Logic to consume messages from RabbitMQ and process each message
async function consumeFromRabbitMQ() {
  const conn = await amqplib.connect(amqpUrl);
  const channel = await conn.createChannel();
  await channel.assertQueue(queueName, { durable: false });

  channel.consume(queueName, (msg) => {
    if (msg !== null) {
      const filename = msg.content.toString();
      console.log(`Get message: ${filename}`);
      processImage(filename);
      channel.ack(msg);
    }
  });
}


// MongoDB client setup
const url = 'mongodb://mongodb:27017';
const client = new MongoClient(url);




// Function to save results to MongoDB
// Logic to save or update the parking time information in MongoDB
async function saveResultToMongoDB(plate, time) {
  await client.connect();
  const db = client.db('mydatabase');
  const collection = db.collection('results');
  const existingEntry = await collection.findOne({ plate });

  if (existingEntry) {
    console.log("Auto is departured");
    const timeIn = existingEntry.time;
    const timeOut = time.toISOString();
    const duration1 = (new Date(timeOut).getTime() - new Date(timeIn).getTime()) ; 
    const duration = duration1 / 60000; // milisec to minutes
    await collection.deleteOne({ plate }); // delete old data
    await collection.insertOne({ plate, timeIn, timeOut, duration }); // add new data with total time
    console.log(`Car total time is ${plate}: ${duration} minutes`);
    
    await sendMail(plate, timeIn, timeOut, duration);
  } else {
    const formattedTime = time.toISOString();
    await collection.insertOne({ plate, time: formattedTime });
    console.log("Auto is arrived :", { plate, time: formattedTime });
  }

  await client.close();
}


// Mail settings
const transporter = nodemailer.createTransport({
  host: 'mail.inbox.lv',
  port: 587, 
  secure: false, 
  auth: {
    user: 'nodejsbotproject@inbox.lv',
    pass: 'kAB4v21yUV'
  },
  tls: {
    rejectUnauthorized: false
  }
});


// Function to send email
async function sendMail(plate, timeIn, timeOut, duration) {
  const mailOptions = {
    from: 'nodejsbotproject@inbox.lv',
    to: 'rinald692@inbox.lv',
    subject: 'Car Parking Info',
    html: `<h1>Parking</h1>
           <p>Number Plate: ${plate}</p>
           <p>Arriving time: ${timeIn}</p>
           <p>Departure time: ${timeOut}</p>
           <p>Total time: ${duration} minutes </p>`
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log('mail error: ' + error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

consumeFromRabbitMQ().catch(console.error);

