const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

app.use(express.static('public'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    //return login.html page
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'))
});

const port = 3001;
app.listen(port, () => {
    console.log(`App is running on port ${port}`);
    console.log(`http://localhost:${port}`);
});