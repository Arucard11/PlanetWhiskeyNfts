import mongoose from 'mongoose';

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: { // Changed from mongoose to mongooseCache to avoid conflict with imported mongoose module
    conn: mongoose.Connection | null;
    promise: Promise<mongoose.Connection> | null;
  };
}

// Export something to make it a module, if necessary, though for global augmentation it might not be needed.
// export {}; 
// Update: Let's name the global variable mongooseCache to avoid potential name collision with the mongoose import itself. 