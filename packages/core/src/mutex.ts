/**
 * A counting semaphore for async functions that manages available permits.
 * Semaphores are mainly used to limit the number of concurrent async tasks.
 *
 * Each `acquire` operation takes a permit or waits until one is available.
 * Each `release` operation adds a permit, potentially allowing a waiting task to proceed.
 *
 * The semaphore ensures fairness by maintaining a FIFO (First In, First Out) order for acquirers.
 */
class Semaphore {
	/**
	 * The maximum number of concurrent operations allowed.
	 */
	public capacity: number

	/**
	 * The number of available permits.
	 */
	public available: number
	private deferredTasks: Array<() => void> = []

	/**
	 * Creates an instance of Semaphore.
	 * @param capacity - The maximum number of concurrent operations allowed.
	 */
	constructor(capacity: number) {
		this.capacity = capacity
		this.available = capacity
	}

	/**
	 * Acquires a semaphore, blocking if necessary until one is available.
	 * @returns A promise that resolves when the semaphore is acquired.
	 */
	async acquire(): Promise<void> {
		if (this.available > 0) {
			this.available--
			return
		}

		return new Promise<void>((resolve) => {
			this.deferredTasks.push(resolve)
		})
	}

	/**
	 * Releases a semaphore, allowing one more operation to proceed.
	 */
	release(): void {
		const deferredTask = this.deferredTasks.shift()

		if (deferredTask != null) {
			deferredTask()
			return
		}

		if (this.available < this.capacity) {
			this.available++
		}
	}
}

/**
 * A Mutex (mutual exclusion lock) for async functions.
 * It allows only one async task to access a critical section at a time.
 *
 * @example
 * const mutex = new Mutex();
 *
 * async function criticalSection() {
 *   await mutex.acquire();
 *   try {
 *     // This code section cannot be executed simultaneously
 *   } finally {
 *     mutex.release();
 *   }
 * }
 */
export class Mutex {
	private semaphore = new Semaphore(1)

	/**
	 * Checks if the mutex is currently locked.
	 * @returns True if the mutex is locked, false otherwise.
	 */
	get isLocked(): boolean {
		return this.semaphore.available === 0
	}

	/**
	 * Acquires the mutex, blocking if necessary until it is available.
	 * @returns A promise that resolves when the mutex is acquired.
	 */
	async acquire(): Promise<void> {
		return this.semaphore.acquire()
	}

	/**
	 * Releases the mutex, allowing another waiting task to proceed.
	 */
	release(): void {
		this.semaphore.release()
	}

	/**
	 * Runs a function while holding the mutex lock.
	 * Automatically acquires before and releases after the function execution.
	 *
	 * @param fn - The function to execute while holding the lock
	 * @returns The result of the function
	 */
	async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
		await this.acquire()
		try {
			return await fn()
		} finally {
			this.release()
		}
	}
}
