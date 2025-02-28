// Function to handle redirect to Stripe payment page
export function redirectToPayment(plan: 'plus' | 'infinity') {
  const links = {
    plus: 'https://buy.stripe.com/bIY3er1vXaWy4y46oq',
    infinity: 'https://buy.stripe.com/fZe4ivcaB1lY3u0eUY'
  };
  
  window.open(links[plan], '_blank');
}