require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const { chatRoutes, commitRoutes, statsRoutes, structureRoutes } = require('./routes');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/', chatRoutes);
app.use('/', commitRoutes);
app.use('/', statsRoutes);
app.use('/', structureRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
