const express = require('express');
const fs = require('fs');
const multer = require('multer');
const app = express();
const port = 3000;
const WebSocket = require('ws'); 
const wss = new WebSocket.Server({ noServer: true });

app.use(express.json());
app.use(express.static('public'));

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});


app.post('/saveData', (req, res) => {
  const data = req.body;
  fs.writeFileSync('data.json', JSON.stringify(data));
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });

  res.sendStatus(200);
});

app.get('/readData', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('data.json'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error reading data' });
  }
});


const admin = require('firebase-admin');
const serviceAccount = require('./public/firebase/serviceAccountKey.json'); // Replace with your service account key file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://viewiiee-default-rtdb.firebaseio.com', 
  storageBucket: 'gs://viewiiee.appspot.com' 
});

 

const bucket = admin.storage().bucket();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get('/upload', (req, res) => {
  res.sendFile(__dirname + '/public/upload.html');
});


// Handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
      return res.status(400).send('No file uploaded.');
  }


  
  const file = req.file;
// const remoteFilePath = 'uploads/' + file.originalname;  
const remoteFilePath = 'Textiiee/uploads/videos/jorat/' + file.originalname;  
   
  const blob = bucket.file(remoteFilePath);
  const blobStream = blob.createWriteStream({
      metadata: {
          contentType: file.mimetype,
          custom: {
            storageLocation: remoteFilePath, // Set the storage location as custom metadata
          },
      }
  });

  blobStream.on('error', (error) => {
      console.error('Error uploading file:', error);
      res.status(500).send('Error uploading file.');
  });

  blobStream.on('finish', () => {
      console.log('File uploaded successfully.');
      res.status(200).send('File uploaded successfully.');
  });
  blobStream.end(file.buffer);
});



app.get('/listFiles', async (req, res) => {
  try {
    const [files] = await bucket.getFiles();
    const fileList = files.map((file) => ({
      name: file.name,
      url: `https://storage.googleapis.com/${bucket.name}/${file.name}`,
      uploadedTime: file.metadata.timeCreated, // This gets the uploaded time
    }));
    res.json(fileList);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Error listing files' });
  }
});

//*********** End Config ***************/
 
app.server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

app.server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});