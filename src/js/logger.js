export class Logger {
  static styles = {
    group: 'color: #6366f1; font-weight: bold;',
    success: 'color: #10B981; font-weight: bold;',
    error: 'color: #EF4444; font-weight: bold;',
    warning: 'color: #F59E0B; font-weight: bold;',
    info: 'color: #3B82F6; font-weight: bold;'
  };

  static group(message) {
    console.group(`%c${message}`, this.styles.group);
  }

  static groupEnd() {
    console.groupEnd();
  }

  static success(message, data = null) {
    if (data) {
      console.log(`%c✓ ${message}`, this.styles.success, data);
    } else {
      console.log(`%c✓ ${message}`, this.styles.success);
    }
  }

  static error(message, error = null) {
    if (error) {
      console.error(`%c✕ ${message}`, this.styles.error, error);
    } else {
      console.error(`%c✕ ${message}`, this.styles.error);
    }
  }

  static warning(message, data = null) {
    if (data) {
      console.warn(`%c⚠ ${message}`, this.styles.warning, data);
    } else {
      console.warn(`%c⚠ ${message}`, this.styles.warning);
    }
  }

  static info(message, data = null) {
    if (data) {
      console.log(`%cℹ ${message}`, this.styles.info, data);
    } else {
      console.log(`%cℹ ${message}`, this.styles.info);
    }
  }

  static performance(label) {
    return {
      start: () => {
        console.time(label);
        Logger.info(`Starting: ${label}`);
      },
      end: () => {
        console.timeEnd(label);
        Logger.success(`Completed: ${label}`);
      }
    };
  }
}