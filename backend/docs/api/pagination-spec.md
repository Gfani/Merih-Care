# Merihcare Pagination & Query Specification

## 1. Query Parameters Standard

All list endpoints accept standard pagination and sorting query parameters:

| Parameter | Type | Default | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | integer | `1` | $\ge 1$ | 1-indexed page number |
| `limit` | integer | `10` | $1 \le \text{limit} \le 100$ | Number of records per page |
| `sort` | string | `createdAt` | Whitelisted fields | Field name to sort by |
| `order` | string | `DESC` | `ASC` or `DESC` | Sorting direction |
| `search` | string | `""` | $\le 100$ chars | Text search keyword across relevant text columns |

---

## 2. Standard Paginated Response Schema

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "apt-101",
        "service": "Doctor Home Visit",
        "amount": 1500,
        "status": "scheduled"
      }
    ],
    "meta": {
      "total": 42,
      "page": 1,
      "limit": 10,
      "totalPages": 5,
      "hasMore": true
    }
  },
  "timestamp": "2026-08-29T12:00:00.000Z",
  "correlationId": "corr-1787820000000"
}
```
