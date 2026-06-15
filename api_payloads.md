# Product Promotion API Payload Examples

Here are the complete HTTP request and response payload structures for both the admin endpoints and the user endpoints.

---

## 🔑 Admin APIs

### 1. Create Promotion
* **Endpoint:** `POST /api/promotions`
* **Request Body:**
  ```json
  {
    "product_id": "65ab3cd4e2949e13d7b1d092",
    "min_quantity": 3,
    "promo_price": 999,
    "description": "Buy 3 same items for ₹999",
    "start_date": "2026-06-14T00:00:00.000Z",
    "end_date": "2026-06-30T23:59:59.000Z"
  }
  ```
* **Response Body (201 Created):**
  ```json
  {
    "success": true,
    "message": "Promotion created successfully",
    "promotion": {
      "_id": "666d2a3f789e5a1b3c9d8e74",
      "product_id": "65ab3cd4e2949e13d7b1d092",
      "min_quantity": 3,
      "promo_price": 999,
      "description": "Buy 3 same items for ₹999",
      "is_active": true,
      "start_date": "2026-06-14T00:00:00.000Z",
      "end_date": "2026-06-30T23:59:59.000Z",
      "createdAt": "2026-06-15T05:15:32.411Z",
      "updatedAt": "2026-06-15T05:15:32.411Z",
      "__v": 0
    }
  }
  ```

---

### 2. Update Promotion
* **Endpoint:** `PUT /api/promotions/:id`
* **Request Body:**
  ```json
  {
    "promo_price": 899,
    "min_quantity": 3,
    "is_active": true
  }
  ```
* **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "message": "Promotion updated successfully",
    "promotion": {
      "_id": "666d2a3f789e5a1b3c9d8e74",
      "product_id": "65ab3cd4e2949e13d7b1d092",
      "min_quantity": 3,
      "promo_price": 899,
      "description": "Buy 3 same items for ₹999",
      "is_active": true,
      "start_date": "2026-06-14T00:00:00.000Z",
      "end_date": "2026-06-30T23:59:59.000Z",
      "createdAt": "2026-06-15T05:15:32.411Z",
      "updatedAt": "2026-06-15T05:20:10.822Z",
      "__v": 0
    }
  }
  ```

---

### 3. Toggle Promotion Status (Quick Enable/Disable)
* **Endpoint:** `PATCH /api/promotions/:id/toggle`
* **Request Body:** None
* **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "message": "Promotion deactivated successfully",
    "is_active": false
  }
  ```

---

### 4. Delete Promotion
* **Endpoint:** `DELETE /api/promotions/:id`
* **Request Body:** None
* **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "message": "Promotion deleted successfully"
  }
  ```

---

### 5. Get All Promotions (Admin Dashboard View)
* **Endpoint:** `GET /api/promotions`
* **Request Body:** None
* **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "count": 1,
    "promotions": [
      {
        "_id": "666d2a3f789e5a1b3c9d8e74",
        "product_id": {
          "_id": "65ab3cd4e2949e13d7b1d092",
          "product_name": "Handmade Clay Pot",
          "price": 400,
          "imageUrls": ["https://s3.amazonaws.com/example/pot1.jpg"],
          "isActive": true
        },
        "min_quantity": 3,
        "promo_price": 999,
        "description": "Buy 3 same items for ₹999",
        "is_active": true,
        "start_date": "2026-06-14T00:00:00.000Z",
        "end_date": "2026-06-30T23:59:59.000Z",
        "createdAt": "2026-06-15T05:15:32.411Z",
        "updatedAt": "2026-06-15T05:15:32.411Z",
        "__v": 0
      }
    ]
  }
  ```

---

## 🛍️ User APIs

### 6. Get Active Promotions (For Promotions Page/Folder)
* **Endpoint:** `GET /api/promotions/active`
* **Request Body:** None
* **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "count": 1,
    "promotions": [
      {
        "_id": "666d2a3f789e5a1b3c9d8e74",
        "product_id": {
          "_id": "65ab3cd4e2949e13d7b1d092",
          "product_name": "Handmade Clay Pot",
          "price": 400,
          "imageUrls": ["https://s3.amazonaws.com/example/pot1.jpg"],
          "avg_rating": 4.5,
          "review_count": 12,
          "isActive": true
        },
        "min_quantity": 3,
        "promo_price": 999,
        "description": "Buy 3 same items for ₹999",
        "is_active": true,
        "start_date": "2026-06-14T00:00:00.000Z",
        "end_date": "2026-06-30T23:59:59.000Z",
        "createdAt": "2026-06-15T05:15:32.411Z",
        "updatedAt": "2026-06-15T05:15:32.411Z",
        "__v": 0
      }
    ]
  }
  ```

---

### 7. Get Active Promotion for a Specific Product
* **Endpoint:** `GET /api/promotions/product/:productId`
* **Request Body:** None
* **Response Body (200 OK):**
  ```json
  {
    "success": true,
    "promotion": {
      "_id": "666d2a3f789e5a1b3c9d8e74",
      "product_id": "65ab3cd4e2949e13d7b1d092",
      "min_quantity": 3,
      "promo_price": 999,
      "description": "Buy 3 same items for ₹999",
      "is_active": true,
      "start_date": "2026-06-14T00:00:00.000Z",
      "end_date": "2026-06-30T23:59:59.000Z",
      "createdAt": "2026-06-15T05:15:32.411Z",
      "updatedAt": "2026-06-15T05:15:32.411Z",
      "__v": 0
    }
  }
  ```

---

### 8. Get Cart Total (With Promotion Savings Calculation)
* **Endpoint:** `GET /api/cart/total/:userId`
* **Request Body:** None
* **Response Body (200 OK):**
  *(Example: User has 4 units of "Handmade Clay Pot" priced at ₹400 each. Minimum quantity is 3 for promo price ₹999. Per-unit promo price is ₹333. Total price becomes $4 \times 333 = ₹1332$)*
  ```json
  {
    "success": true,
    "totalAmount": 1600,
    "totalAfterPromo": 1332,
    "uniqueItemCount": 1,
    "promotion_savings": 268,
    "addition_discount": 0,
    "first_order_discount": 0,
    "totalAmountAfterDiscount": 1332,
    "items": [
      {
        "productId": "65ab3cd4e2949e13d7b1d092",
        "quantity": 4,
        "unitPrice": 400,
        "normalTotal": 1600,
        "promoApplied": true,
        "promoSetsUsed": 1,
        "promoDescription": "Buy 3 same items for ₹999",
        "finalTotal": 1332
      }
    ]
  }
  ```
