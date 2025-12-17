import { injectable } from 'tsyringe';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';

export interface GpioCommand {
  command: 'set_color' | 'pulse' | 'blink' | 'off';
  params?: any;
}

@injectable()
export class GpioService extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null;
  private isEnabled = false;

  constructor() {
    super();
    // Only attempt to run the GPIO script on Linux platforms (like the Raspberry Pi)
    if (process.platform === 'linux') {
      this.isEnabled = true;
      this.spawnProcess();
    } else {
      console.log('⚠️  GPIO service is disabled on non-Linux platform.');
    }
  }

  private spawnProcess(): void {
    if (!this.isEnabled) return;

    const scriptPath = path.join(__dirname, '..', 'gpio_handler.py');
    console.log(`🔧 Spawning GPIO handler script: ${scriptPath}`);
    
    this.process = spawn('python3', [scriptPath]);

    this.process.stdout.on('data', (data: Buffer) => {
      const messages = data.toString().trim().split('\n');
      messages.forEach(message => {
        try {
          const event = JSON.parse(message);
          
          switch (event.event) {
            case 'button_click':
              console.log('🔘 Button Click detected!');
              this.emit('button_click');
              break;
            case 'button_long_press':
              console.log('⏳ Button Long Press detected!');
              this.emit('button_long_press');
              break;
            case 'button_pressed': // Legacy/Fallback
              console.log('🔘 Button press detected!');
              this.emit('button_pressed');
              break;
          }
        } catch (error) {
          // Non-JSON output can be treated as logs
          console.log(`[GpioService] Python stdout: ${message}`);
        }
      });
    });

    this.process.stderr.on('data', (data: Buffer) => {
      console.error(`[GpioService] Python stderr: ${data.toString()}`);
    });

    this.process.on('close', (code) => {
      console.log(`[GpioService] Python script exited with code ${code}`);
      this.process = null;
      // Optional: auto-restart on unexpected exit
      if (code !== 0) {
        console.log('[GpioService] Restarting Python script in 5 seconds...');
        setTimeout(() => this.spawnProcess(), 5000);
      }
    });

    this.process.on('error', (err) => {
      console.error('[GpioService] Failed to start Python script.', err);
      this.isEnabled = false;
    });
  }

  public sendCommand(command: GpioCommand): void {
    if (!this.process || !this.isEnabled) {
      return;
    }
    this.process.stdin.write(JSON.stringify(command) + '\n');
  }

  public setColor(r: number, g: number, b: number): void {
    this.sendCommand({ command: 'set_color', params: { r, g, b } });
  }

  public pulse(onColor: [number, number, number] = [0, 0, 1], offColor: [number, number, number] = [0, 0, 0], fadeIn = 1, fadeOut = 1): void {
    this.sendCommand({ command: 'pulse', params: { on_color: onColor, off_color: offColor, fade_in: fadeIn, fade_out: fadeOut } });
  }

  public blink(color: [number, number, number] = [1, 1, 0], onTime = 0.5, offTime = 0.5): void {
    this.sendCommand({ command: 'blink', params: { color, on_time: onTime, off_time: offTime } });
  }

  public off(): void {
    this.sendCommand({ command: 'off' });
  }

  public cleanup(): void {
    if (this.process) {
      this.process.kill();
    }
  }
}
