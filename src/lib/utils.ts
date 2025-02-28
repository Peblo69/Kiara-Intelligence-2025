const GREETINGS = [
  "Hey, how can I help you today?",
  "How can I assist you today?",
  "Welcome, how can I help you?"
];

export function getRandomGreeting(): string {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}