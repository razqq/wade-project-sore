import json

def responseUserInfo(original_data):
    # A mapping from full property URLs to simple field names
    property_to_field = {
        "http://example.com/resource/email": "email",
        "http://example.com/resource/name": "name",
        "http://example.com/resource/userId": "userId",
        "http://example.com/resource/gender": "gender"
    }
    
    # Initialize an empty dict for the transformed data
    transformed_data = {}

    # Process each item in the results
    for item in original_data["results"]:
        property_url = item["property"]
        if property_url in property_to_field:
            field_name = property_to_field[property_url]
            transformed_data[field_name] = item["value"]

    # Output the transformed data as JSON
    return json.dumps(transformed_data, indent=4)