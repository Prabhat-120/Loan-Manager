import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../common/logger/index.js';

export const isDatabaseReady = (): boolean => {
  return mongoose.connection.readyState === 1;
};

export const connectDatabase = async (): Promise<typeof mongoose> => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected cleanly');
  } catch (error) {
    logger.error('Error disconnecting MongoDB:', error);
  }
};
