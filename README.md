# Tomba Clearbit-Person Actor

[![Actor](https://img.shields.io/badge/Apify-Actor-blue)](https://apify.com/actors)
[![Tomba API](https://img.shields.io/badge/Tomba-API-green)](https://tomba.io)
[![Rate Limit](https://img.shields.io/badge/Rate%20Limit-150%2Fmin-orange)](https://tomba.io/api)

A powerful Apify Actor that enriches person information using the **Tomba Person Enrichment API**. Perfect for sales teams, marketers, and researchers who need comprehensive person data for lead generation, recruitment, and business intelligence based on email addresses.

## Key Features

- **Person Enrichment**: Get detailed person information from email addresses
- **Comprehensive Data**: Personal details, employment information, location, and contact data
- **Professional Intelligence**: Job titles, company information, department, and seniority levels
- **Social Profiles**: LinkedIn, Twitter, and Facebook profile information
- **Email Verification**: Real-time email validation and deliverability status
- **Rate Limited**: Respects Tomba's 150 requests per minute limit
- **Bulk Processing**: Process multiple email addresses efficiently
- **Error Handling**: Robust error handling with detailed logging

## How it works

The Actor leverages Tomba's powerful Person Enrichment API to gather comprehensive personal and professional information:

### Process Flow

1. **Authentication**: Connects to Tomba API using your credentials
2. **Email Processing**: Accepts array of email addresses to enrich
3. **Data Validation**: Processes and validates person information
4. **Rate Limiting**: Automatically handles 150 requests/minute limit
5. **Data Storage**: Saves results to Apify dataset

### What You Get

For each email address, you'll receive:

- **Personal Details**: Full name, location, gender, and profile information
- **Employment Data**: Company name, job title, department, and seniority level
- **Contact Information**: Email verification status and phone availability
- **Social Presence**: LinkedIn, Twitter, and Facebook profile links
- **Professional Context**: Company domain, role level, and employment timeline
- **Source Tracking**: Data source and processing status

## Quick Start

### Prerequisites

1. **Tomba Account**: Sign up at [Tomba.io](https://app.tomba.io/api) to get your API credentials

### Getting Your API Keys

1. Visit [Tomba API Dashboard](https://app.tomba.io/api)
2. Copy your **API Key** (starts with `ta_`)
3. Copy your **Secret Key** (starts with `ts_`)

## Input Configuration

### Required Parameters

| Parameter        | Type     | Description                     |
| ---------------- | -------- | ------------------------------- |
| `tombaApiKey`    | `string` | Your Tomba API key (ta_xxxx)    |
| `tombaApiSecret` | `string` | Your Tomba secret key (ts_xxxx) |
| `emails`         | `array`  | Array of emails to enrich       |

### Optional Parameters

| Parameter    | Type     | Default | Description                         |
| ------------ | -------- | ------- | ----------------------------------- |
| `maxResults` | `number` | `50`    | Maximum number of results to return |

### Example Input

```json
{
    "tombaApiKey": "ta_xxxxxxxxxxxxxxxxxxxx",
    "tombaApiSecret": "ts_xxxxxxxxxxxxxxxxxxxx",
    "emails": ["john@example.com", "jane@company.com", "contact@business.org"],
    "maxResults": 100
}
```

### Best Practices

- **Email Selection**: Use clean, valid email addresses for better results
- **Rate Limits**: The Actor automatically handles Tomba's 150 requests/minute limit
- **Batch Size**: Process 10-50 emails at a time for optimal performance

## Output Data Structure

The Actor returns comprehensive person enrichment data for each email address:

### Example Output

```json
{
    "name": {
        "fullName": "John Doe",
        "givenName": "John",
        "familyName": "Doe"
    },
    "email": "john@example.com",
    "location": "US",
    "gender": "male",
    "geo": {
        "city": "San Francisco",
        "state": "California",
        "country": "United States",
        "countryCode": "US"
    },
    "employment": {
        "domain": "example.com",
        "name": "Example Inc",
        "title": "Senior Software Engineer",
        "role": "executive",
        "department": "engineering",
        "seniority": "senior"
    },
    "linkedin": {
        "handle": "https://www.linkedin.com/in/johndoe"
    },
    "twitter": {
        "handle": "https://twitter.com/johndoe"
    },
    "verification": {
        "date": "2025-10-20T00:00:00+02:00",
        "status": "valid"
    },
    "phone": true,
    "avatar": "https://example.com/avatar.jpg",
    "bio": "Senior Software Engineer with 10+ years experience",
    "website": "https://johndoe.com",
    "indexedAt": "2025-10-20T12:00:00+02:00",
    "source": "tomba_person_enrichment"
}
```

### Data Structure Overview

The output contains comprehensive person information organized into logical sections:

#### Personal Information

- **Identity**: Full name, first name, last name
- **Demographics**: Gender, location, geographic details
- **Contact**: Email verification status, phone availability
- **Digital Presence**: Profile picture, personal website, bio

#### Professional Information

- **Employment**: Company name, domain, job title, department
- **Career Level**: Role type, seniority level, professional status
- **Industry Context**: Company information and professional background

#### Social Profiles

- **LinkedIn**: Professional profile URL and information
- **Twitter**: Social media presence and handles
- **Facebook**: Social network profiles when available

#### Data Quality & Metadata

- **Verification**: Email validation status and verification dates
- **Source Tracking**: Data source identification and processing status
- **Freshness**: Index dates and data currency information

### Key Benefits

- **Email-Based Enrichment**: Perfect for person research based on email addresses
- **Comprehensive Coverage**: 20+ data points per person enrichment
- **Real-time Verification**: Email validation and deliverability checks
- **Professional Context**: Employment details and career information
- **Social Intelligence**: Social media profiles and digital presence

## Use Cases

- **Lead Generation**: Enrich prospect profiles with detailed personal and professional information
- **Recruitment**: Research candidates and gather comprehensive background information
- **Sales Intelligence**: Get detailed person data for better targeting and personalization
- **Market Research**: Analyze professional profiles and industry connections
- **Data Enrichment**: Enhance existing contact databases with fresh person information
- **Networking**: Research contacts and build professional relationship context
- **Customer Research**: Understand customer profiles and professional backgrounds

## Resources & Documentation

### API Documentation

- [Tomba API Docs](https://docs.tomba.io/introduction) - Complete API reference
- [Authentication Guide](https://app.tomba.io/api) - Get your API keys
- [Pricing & Limits](https://tomba.io/pricing) - Understand rate limits and costs
- [Person Enrichment API](https://docs.tomba.io/api/enrichment#person-api) - Specific endpoint documentation
