const app = require('./src/app');
const { PORT } = require('./src/config/env');

app.listen(PORT, () => console.log(`Backend escuchando en el puerto ${PORT}`));
