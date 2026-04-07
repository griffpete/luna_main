require('dotenv').config();
const express = require('express');
const { chatRoutes, commitRoutes, statsRoutes } = require('./routes');

const app = express();
app.use(express.json());

app.use('/', chatRoutes);
app.use('/', commitRoutes);
app.use('/', statsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
