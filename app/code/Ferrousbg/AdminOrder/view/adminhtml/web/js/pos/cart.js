define([], function () {
    'use strict';

    return function () {
        return {
            cart: [],
            grandTotal: 0,

            addToCart(product) {
                let existing = this.cart.find(i => i.id === product.id);
                if (existing) {
                    existing.qty++;
                } else {
                    this.cart.push({ ...product, qty: 1 });
                }
                this.calculateTotal();
            },

            removeFromCart(item) {
                this.cart = this.cart.filter(i => i.id !== item.id);
                this.calculateTotal();
            },

            calculateTotal() {
                this.grandTotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
            },

            formatPrice(price) {
                return parseFloat(price).toFixed(2) + ' лв.';
            }
        };
    };
});