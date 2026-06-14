import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[MedSync Device REST API] Listening on port ${PORT}`);
});
