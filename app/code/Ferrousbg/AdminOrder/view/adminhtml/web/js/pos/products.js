define([], function () {
    'use strict';

    return function () {
        return {
            // --- STATE ---
            searchQuery: '',
            searchResults: [],
            productModalOpen: false,
            selectedProduct: null,

            // --- LOGIC ---
            searchProducts() {
                if (this.searchQuery.length < 3) return;

                this.loading = true;
                fetch(this.urls.searchUrl + '?store_id=' + this.currentStoreId + '&q=' + encodeURIComponent(this.searchQuery))
                    .then(r => r.json())
                    .then(data => {
                        this.searchResults = data;
                        this.loading = false;
                    });
            },

            selectProduct(p) {
                // Логика за добавяне в количката
                this.addToCart(p);
                this.searchQuery = '';
                this.searchResults = [];
            }
        };
    };
});