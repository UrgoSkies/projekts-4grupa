// Required modules
const express = require('express');
const multer = require('multer');
const Minio = require('minio');
const amqplib = require('amqplib');
const { exec } = require('child_process');
const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
console.log(`ist working`);

// Initializing express application
const app = express();
const port = 3002;
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
//multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });




// Minio settings
const minioClient = new Minio.Client({
    endPoint: 'minio',
    port: 9000,
    useSSL: false,
    accessKey: 'admin123',
    secretKey: 'admin123'
});

// Bucket settings 
const bucketName = 'app1';
minioClient.bucketExists(bucketName, function(err, exists) {
    if (err) {
        return console.log(err);
    }
    if (!exists) {
        minioClient.makeBucket(bucketName, 'us-east-1', function(err) {
            if (err) {
                return console.log('Error creating bucket.', err);
            }
            console.log(`Bucket created successfully in "us-east-1".`);
        });
    }
});


// rabbit connection
const amqpUrl = 'amqp://rabbitmq';

async function publishToRabbitMQ(filename) {
    const conn = await amqplib.connect(amqpUrl);
    const channel = await conn.createChannel();
    const queue = 'fileQueue';

    await channel.assertQueue(queue, { durable: false });
    channel.sendToQueue(queue, Buffer.from(filename));
    console.log(" [x] Sent %s", filename);

    await channel.close();
    await conn.close();
}

// endpiont for file ddownload
app.post('/upload', upload.single('file'), (req, res) => {
    console.log(req.file); // chek if file uploaded

    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const file = req.file;
    const bucketName = 'app1';

    // download file to minio
    minioClient.putObject(bucketName, file.originalname, file.buffer, function(error, etag) {
        if (error) {
            console.log(error);
            return res.status(500).send('Error uploading file.');
        }
        console.log('File uploaded successfully.');

        // send filename to rabbit
        publishToRabbitMQ(file.originalname).then(() => {
            res.send('File downloaded and send to RabbitMQ');
        }).catch(error => {
            console.log(error);
            res.status(500).send('Error sending filename to RabbitMQ.');
        });
    });
});


const mongoUri = 'mongodb://mongodb:27017';
const client = new MongoClient(mongoUri);

app.get('/result', async (req, res) => {
    try {
        await client.connect();
        const db = client.db('mydatabase');
        const collection = db.collection('results');
        const results = await collection.find({}).toArray();

        res.json(results);
    } catch (error) {
        console.error('Error Mongo:', error);
        res.status(500).send('Server error');
    } finally {
        await client.close();
    }
});


// Start the Express server
app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});


