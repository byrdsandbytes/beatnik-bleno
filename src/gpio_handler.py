#!/usr/bin/env python3
import sys
import json
import random
from time import time
from gpiozero import RGBLED, Button
from signal import pause

# --- Pin Configuration (BCM) ---
PIN_RED = 17
PIN_GREEN = 27
PIN_BLUE = 24
PIN_BUTTON = 26

# --- Initialization ---
try:
    # Initialize RGB LED as a common-anode type
    led = RGBLED(red=PIN_RED, green=PIN_GREEN, blue=PIN_BLUE, active_high=False)
    # Initialize Button (pull_up=True since it's connected to GND)
    # Added bounce_time to prevent "Short Press" (Status Check) from firing immediately after "Long Press" release
    button = Button(PIN_BUTTON, pull_up=True, bounce_time=0.05)
except Exception as e:
    sys.stderr.write(f"Error initializing GPIO: {e}\n")
    sys.exit(1)

# --- Event Handlers ---
press_start_time = 0

def on_button_pressed():
    """Record the start time when the button is pressed."""
    global press_start_time
    press_start_time = time()

def on_button_released():
    """Calculate duration and send appropriate event."""
    global press_start_time
    duration = time() - press_start_time
    
    if duration < 2:
        event_name = "button_click"
    else:
        event_name = "button_long_press"
        
    event = {"event": event_name, "duration": duration}
    sys.stdout.write(json.dumps(event) + '\n')
    sys.stdout.flush()

button.when_pressed = on_button_pressed
button.when_released = on_button_released

# --- Command Functions ---
def set_color(r, g, b):
    """Set a solid color."""
    led.color = (r, g, b)

def pulse(on_color=(1, 1, 1), off_color=(0, 0, 0), fade_in=1, fade_out=1):
    """Pulse the LED with a given color."""
    led.pulse(fade_in_time=fade_in, fade_out_time=fade_out, on_color=tuple(on_color), off_color=tuple(off_color), background=True)

def blink(color=(1, 1, 1), on_time=0.5, off_time=0.5):
    """Blink the LED with a given color."""
    led.blink(on_time=on_time, off_time=off_time, on_color=tuple(color), off_color=(0, 0, 0), background=True)

def turn_off():
    """Turn the LED off."""
    led.off()

# --- Main Loop ---
def listen_for_commands():
    """Read commands from stdin and execute them."""
    # Start with LED Amber (Red + Green)
    set_color(0.15, 0.2, 0.15)
    # timeout 2 seconds then white
    # led.pulse(fade_in_time=2, fade_out_time=2, on_color=(0.5, 0.5, 0.5), off_color=(0, 0, 0), background=True)
    # # Indicate readiness by pulse red than green than blue
    # led.pulse(fade_in_time=0.5, fade_out_time=0.5, on_color=(1, 0, 0), off_color=(0, 0, 0), background=True)
    # led.pulse(fade_in_time=0.5, fade_out_time=0.5, on_color=(0, 1, 0), off_color=(0, 0, 0), background=True)
    # led.pulse(fade_in_time=0.5, fade_out_time=0.5, on_color=(0, 0, 1), off_color=(0, 0, 0), background=True)
    
    sys.stderr.write("GPIO handler script started and listening for commands.\n")
    
    for line in sys.stdin:
        try:
            cmd = json.loads(line)
            command = cmd.get("command")
            params = cmd.get("params", {})

            if command == "set_color":
                set_color(params.get("r", 0), params.get("g", 0), params.get("b", 0))
            elif command == "pulse":
                pulse(
                    on_color=params.get("on_color", [0, 0, 1]), 
                    off_color=params.get("off_color", [0, 0, 0]),
                    fade_in=params.get("fade_in", 1), 
                    fade_out=params.get("fade_out", 1)
                )
            elif command == "blink":
                blink(color=params.get("color", [1, 1, 0]), on_time=params.get("on_time", 0.5), off_time=params.get("off_time", 0.5))
            elif command == "off":
                turn_off()
            else:
                sys.stderr.write(f"Unknown command: {command}\n")

        except json.JSONDecodeError:
            sys.stderr.write(f"Invalid JSON received: {line.strip()}\n")
        except Exception as e:
            sys.stderr.write(f"Error processing command: {e}\n")

if __name__ == "__main__":
    listen_for_commands()
