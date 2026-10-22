// Errore "previsto" dell'applicazione: porta con sé lo status HTTP da restituire.
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

module.exports = AppError;
