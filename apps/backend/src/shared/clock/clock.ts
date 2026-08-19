export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now() {
    return new Date();
  }
}

export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now() {
    return new Date(this.current);
  }

  set(current: Date) {
    this.current = new Date(current);
  }
}
