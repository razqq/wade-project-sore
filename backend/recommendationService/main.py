from flask import Flask, request, jsonify
from SPARQLWrapper import SPARQLWrapper, JSON
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app)
SPARQL_ENDPOINT_URL = "http://localhost:9999/blazegraph/sparql"

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

    print("Debug - original_data:", original_data)  # Debugging line


    # Process each item in the results
    for item in original_data["results"]:
        property_url = item["property"]
        if property_url in property_to_field:
            field_name = property_to_field[property_url]
            transformed_data[field_name] = item["value"]

    # Output the transformed data as JSON
    return json.dumps(transformed_data, indent=4)

def execute_sparql_query(query, append_id=False, noNeedtoTransform=False):
    sparql = SPARQLWrapper(SPARQL_ENDPOINT_URL)
    sparql.setQuery(query)
    sparql.setReturnFormat(JSON)

    try:
        results = sparql.query().convert()
    except Exception as e:
        return {"error": str(e)}, 500

    if noNeedtoTransform:
        return results

    output = []
    for result in results["results"]["bindings"]:
        item_info = {var: result[var]["value"] for var in result}
        if append_id:
            item_id = item_info.get('user', '').rsplit('/', 1)[-1]
            item_info['id'] = item_id
        output.append(item_info)
    return output

def prefixed_query(query_body):
    return f"""
    PREFIX ex: <http://example.com/resource/>
    PREFIX rel: <http://example.com/resource/relationship/>
    {query_body}
    """

# get information about a user
def prepare_query_user(userId, limit):
    query_body = f'''
    SELECT ?user ?property ?value
    WHERE {{
    ?user ex:userId "{userId}" ;
            ?property ?value .
    }}
    '''

    if limit and limit.isdigit():
        query_body += f" LIMIT {limit}"

    return query_body

@app.route('/query/user', methods=['GET'])
def get_user():
    userId = request.args.get('userId') 
    pretty = request.args.get('pretty')
    if not userId:
        return jsonify({"error": "Missing 'userId' in request query parameter"}), 400

    query_body = prepare_query_user(userId, None)

    results = {"results": execute_sparql_query(prefixed_query(query_body))}
    print("Debug - results:", pretty)  # Debugging line
    if pretty == "0":
        return responseUserInfo(results)
    return results



# get a list of  similar artists
def get_user_similar_artists_query(userId, limit):
    query_body = f'''
    SELECT DISTINCT ?id ?name
    WHERE {{
        ?user ex:userId "{userId}" .
        ?user rel:LIKES ?a .
        ?a ex:name ?aName .
        ?otherUsers rel:LIKES ?a .
        ?a rel:SIMILAR_TO ?b .
        ?b ex:artist_id ?id .
        ?b ex:name ?name .
        FILTER NOT EXISTS {{ ?user rel:LIKES ?b }}
        FILTER NOT EXISTS {{ ?user rel:DISLIKES ?b }}
        FILTER NOT EXISTS {{ ?otherUsers rel:DISLIKES ?b }}
    }}
    ORDER BY ?bName
    '''

    if limit and limit.isdigit():
        query_body += f" LIMIT {limit}"

    return query_body

@app.route('/query/user/similar_artists', methods=['GET'])
def get_user_similar_artists():
    limit = request.args.get('limit')
    userId = request.args.get('userId') 
    if not userId:
        return jsonify({"error": "Missing 'userId' in request query parameter"}), 400

    query_body = get_user_similar_artists_query(userId, limit)
    return jsonify({"results": execute_sparql_query(prefixed_query(query_body))})


# get a list of artists that other Users :LIKES same Artist as the current user
def get_user_friends_liked_query(userId, limit, skip):
    query_body = f'''
    SELECT (GROUP_CONCAT(DISTINCT ?aName; separator=", ") AS ?reason) (SAMPLE(?bArtistId) AS ?id) (SAMPLE(?bName) AS ?name) (SAMPLE(?fName) AS ?recommended_by)
    WHERE {{
        ?user ex:userId "{userId}" .
        ?u rel:LIKES ?a .
        ?a ex:name ?aName .

        ?f rel:LIKES ?a .
        ?f ex:name ?fName .

        ?f rel:LIKES ?b .
        ?b ex:artist_id ?bArtistId .
        ?b ex:name ?bName .

        FILTER NOT EXISTS {{ ?u rel:LIKES ?b }}
        FILTER NOT EXISTS {{ ?u rel:DISLIKES ?b }}
        FILTER NOT EXISTS {{ ?a rel:SIMILAR_TO ?b }}
    }}
    GROUP BY ?bArtistId
    ORDER BY ?bName
    '''

    if limit and limit.isdigit():
        query_body += f" LIMIT {limit}"

    if skip and skip.isdigit():
        query_body += f" OFFSET {skip}"

    return query_body

@app.route('/query/user/friends_liked', methods=['GET'])
def get_user_friends_liked():
    limit = request.args.get('limit')
    skip = request.args.get('skip')
    userId = request.args.get('userId') 
    if not userId:
        return jsonify({"error": "Missing 'userId' in request query parameter"}), 400

    query_body = get_user_friends_liked_query(userId, limit, skip)
    return jsonify({"results": execute_sparql_query(prefixed_query(query_body))})


# get a list of artists that other User :HAS_HOMETOWN as the current user
def get_user_friends_location_query(userId, limit, skip):
    query_body = f'''
    SELECT (SAMPLE(?bArtistId) AS ?id) (SAMPLE(?bName) AS ?name) (SAMPLE(?lName) AS ?locationName) (SAMPLE(?fName) AS ?recommended_by)
    WHERE {{
        ?user ex:userId "{userId}" .
        ?user rel:LIKES ?a .
        {{
            ?u rel:LOCATED_IN ?l .
        }} UNION {{
            ?u rel:HAS_HOMETOWN ?l .
        }}
        ?l ex:name ?lName .

        {{
            ?f rel:LOCATED_IN ?l .
        }} UNION {{
            ?f rel:HAS_HOMETOWN ?l .
        }}
        ?f ex:name ?fName .

        ?f rel:LIKES ?b .
        ?b ex:artist_id ?bArtistId .
        ?b ex:name ?bName .

        FILTER NOT EXISTS {{ ?u rel:DISLIKES ?b }}

        FILTER NOT EXISTS {{
            ?u rel:LIKES ?commonArtist .
            ?f rel:LIKES ?commonArtist .
        }}
        
    }}
    GROUP BY ?bArtistId
    ORDER BY ?bName
    '''

    if limit and limit.isdigit():
        query_body += f" LIMIT {limit}"

    if skip and skip.isdigit():
        query_body += f" OFFSET {skip}"

    return query_body

@app.route('/query/user/friends_location', methods=['GET'])
def get_user_friends_location():
    limit = request.args.get('limit')
    skip = request.args.get('skip')
    userId = request.args.get('userId') 
    if not userId:
        return jsonify({"error": "Missing 'userId' in request query parameter"}), 400

    query_body = get_user_friends_location_query(userId, limit, skip)
    return jsonify({"results": execute_sparql_query(prefixed_query(query_body))})


# get a list of artists that other User :WORKS_AS as the current user
def get_user_friends_job_query(userId, limit, skip):
    query_body = f'''
    SELECT (SAMPLE(?bArtistId) AS ?id) (SAMPLE(?bName) AS ?name) 
       (SAMPLE(?jName) AS ?jobName) (SAMPLE(?fName) AS ?recommended_by)
    WHERE {{
        ?u ex:userId "{userId}" .
        ?u rel:LIKES ?a .

        ?u rel:WORKS_AS ?j .
        ?j ex:name ?jName .

        ?f rel:WORKS_AS ?j .
        ?f ex:name ?fName .

        ?f rel:LIKES ?b .
        ?b ex:artist_id ?bArtistId .
        ?b ex:name ?bName .
        
        FILTER NOT EXISTS {{ ?u rel:DISLIKES ?b }}

        FILTER NOT EXISTS {{
            ?u rel:LIKES ?commonArtist .
            ?f rel:LIKES ?commonArtist .
        }}
    }}
    GROUP BY ?bArtistId
    ORDER BY ?bName
    '''

    if limit and limit.isdigit():
        query_body += f" LIMIT {limit}"

    if skip and skip.isdigit():
        query_body += f" OFFSET {skip}"

    return query_body

@app.route('/query/user/friends_job', methods=['GET'])
def get_user_friends_job():
    limit = request.args.get('limit')
    skip = request.args.get('skip')
    userId = request.args.get('userId') 
    if not userId:
        return jsonify({"error": "Missing 'userId' in request query parameter"}), 400

    query_body = get_user_friends_job_query(userId, limit, skip)
    return jsonify({"results": execute_sparql_query(prefixed_query(query_body))})


# get a list of random artists
def get_random_artists_query(userId, limit):
    query_body = f'''
    SELECT DISTINCT ?id ?name
    WHERE {{
        ?u ex:userId "{userId}" .

        {{
            ?u rel:LIKES ?a .
        }} UNION {{
            ?u rel:DISLIKES ?a .
        }}

        {{
            ?u rel:LOCATED_IN ?l .
        }} UNION {{
            ?u rel:HAS_HOMETOWN ?l .
        }}
        {{
            ?otherUsers rel:LOCATED_IN ?l .
        }} UNION {{
            ?otherUsers rel:HAS_HOMETOWN ?l .
        }}

        {{
            ?otherUsers rel:LIKES ?otherLikedDisliked .
        }} UNION {{
            ?otherUsers rel:DISLIKES ?otherLikedDisliked .
        }}

        ?a rel:SIMILAR_TO ?similar .

        ?b ex:artist_id ?id .
        ?b ex:name ?name .
        FILTER NOT EXISTS {{ ?u rel:LIKES|rel:DISLIKES ?b }}
        FILTER NOT EXISTS {{ ?u rel:LIKES|rel:DISLIKES ?similar }}
        FILTER NOT EXISTS {{ ?otherUsers rel:LIKES|rel:DISLIKES ?b }}
        FILTER NOT EXISTS {{ ?a rel:SIMILAR_TO ?b }}
    }}
    ORDER BY RAND()
    '''

    if limit and limit.isdigit():
        query_body += f" LIMIT {limit}"

    return query_body

@app.route('/query/user/random_artists', methods=['GET'])
def get_random_artists():
    limit = request.args.get('limit')
    userId = request.args.get('userId') 
    if not userId:
        return jsonify({"error": "Missing 'userId' in request query parameter"}), 400

    query_body = get_random_artists_query(userId, limit)
    return jsonify({"results": execute_sparql_query(prefixed_query(query_body))})

# post like relationship between user and artist
def get_user_iri(userId):
    query_body = f'''
    SELECT ?user
    WHERE {{
         ?user ex:userId "{userId}" .
    }}
    '''

    results = execute_sparql_query(prefixed_query(query_body))
    print("Debug - results:", results)  # Debugging line
    if not results:
        return None
    return results[0]['user']

def get_artist_iri(artistId):
    query_body = f'''
    SELECT ?artist
    WHERE {{
         ?artist ex:artist_id "{artistId}" .
    }}
    '''

    results = execute_sparql_query(prefixed_query(query_body))
    if not results:
        return None
    return results[0]['artist']


def ask_user_likes_query(userId, artistId):
    query_body = f'''
    ASK {{
            SELECT ?user ?artist
        WHERE {{
        ?user ex:userId "{userId}" .
        ?artist ex:artist_id "{artistId}" .
        FILTER NOT EXISTS {{ ?user rel:LIKES ?artist }}
        }}
    }}
    '''

    return query_body

def insert_user_likes_query(userId, artistId):
    user_iri = get_user_iri(userId)
    artist_iri = get_artist_iri(artistId)

    print("Debug - results:", user_iri, artist_iri)  # Debugging line

    query_body = f'''
    INSERT {{
        ?user rel:LIKES ?artist .
        ?relationshipNode ex:created ?timestamp .
    }}
    WHERE {{
         # Bind the URIs for user and artist
        BIND (IRI("{user_iri}") AS ?user)
        BIND (IRI("{artist_iri}") AS ?artist)
        
        # Generate a unique IRI for the relationship node (if you want to store the timestamp or other data)
        BIND (IRI(CONCAT("http://example.com/resource/relationship/", STRUUID())) AS ?relationshipNode)
        
        # Get the current timestamp (you might need to handle this in your application logic)
        BIND (NOW() AS ?timestamp)

        
        # Check conditions
        FILTER NOT EXISTS {{ ?user rel:DISLIKES ?artist }}
        FILTER NOT EXISTS {{ ?user rel:LIKES ?artist }}
    }}
    '''

    return query_body

@app.route('/query/user/likes', methods=['POST'])
def post_user_likes():
    # get the userId and artistId from the request body
    userId = request.json.get('userId')
    artistId = request.json.get('artistId')
    if not userId or not artistId:
        return jsonify({"error": "Missing 'userId' or 'artistId' in request body"}), 400

    ask_query = ask_user_likes_query(userId,artistId)
    result_ask = execute_sparql_query(prefixed_query(ask_query), noNeedtoTransform=True)
    if not result_ask['boolean']:
        return jsonify({"error": "User like the artist already / dislikes the artist"}), 400

    insert_query = insert_user_likes_query(userId, artistId)
    execute_sparql_query(prefixed_query(insert_query), noNeedtoTransform=True)
    return jsonify({"message": "Artist liked successfully"})

# post dislike relationship between user and artist
def ask_user_dislikes_query(userId, artistId):
    query_body = f'''
    ASK {{
            SELECT ?user ?artist
        WHERE {{
        ?user ex:userId "{userId}" .
        ?artist ex:artist_id "{artistId}" .
        FILTER NOT EXISTS {{ ?user rel:DISLIKES ?artist }}
        }}
    }}
    '''

    return query_body

def insert_user_dislikes_query(userId, artistId):
    user_iri = get_user_iri(userId)
    artist_iri = get_artist_iri(artistId)

    print("Debug - results:", user_iri, artist_iri)  # Debugging line

    query_body = f'''
    INSERT {{
        ?user rel:DISLIKES ?artist .
        ?relationshipNode ex:created ?timestamp .
    }}
    WHERE {{
         # Bind the URIs for user and artist
        BIND (IRI("{user_iri}") AS ?user)
        BIND (IRI("{artist_iri}") AS ?artist)
        
        # Generate a unique IRI for the relationship node (if you want to store the timestamp or other data)
        BIND (IRI(CONCAT("http://example.com/resource/relationship/", STRUUID())) AS ?relationshipNode)
        
        # Get the current timestamp (you might need to handle this in your application logic)
        BIND (NOW() AS ?timestamp)

        
        # Check conditions
        FILTER NOT EXISTS {{ ?user rel:DISLIKES ?artist }}
        FILTER NOT EXISTS {{ ?user rel:LIKES ?artist }}
    }}
    '''

    return query_body

@app.route(
        '/query/user/dislikes', methods=['POST'])
def post_user_dislikes():
    # get the userId and artistId from the request body
    userId = request.json.get('userId')
    artistId = request.json.get('artistId')
    if not userId or not artistId:
        return jsonify({"error": "Missing 'userId' or 'artistId' in request body"}), 400

    ask_query = ask_user_dislikes_query(userId,artistId)
    result_ask = execute_sparql_query(prefixed_query(ask_query), noNeedtoTransform=True)
    if not result_ask['boolean']:
        return jsonify({"error": "User dislikes the artist already / likes the artist"}), 400

    insert_query = insert_user_dislikes_query(userId, artistId)
    execute_sparql_query(prefixed_query(insert_query), noNeedtoTransform=True)
    return jsonify({"message": "Artist liked successfully"})


# get history of liked and disliked artists
def update_relationship(json_data):
    # Iterate through each item in the 'results' list
    for item in json_data['results']:
        # Extract the relationship type value
        artist = get_artist_name_id(item['artist'])
        if artist:
            item['artistName'] = artist['name']
            item['artistId'] = artist['id']
        item.pop('artist', None)

        relationship_type = item.pop('relationshipType', None)
        if relationship_type:
            # Update the key name to 'relationship' and set its value to the last part after the last '/'
            item['relationship'] = relationship_type.split('/')[-1]
    return json_data

def get_artist_name_id(artist_iri):
    query_body = f'''
    SELECT ?name ?id
    WHERE {{
        BIND (IRI("{artist_iri}") AS ?artist)
        ?artist ex:name ?name .
        ?artist ex:artist_id ?id .
    }}
    '''

    results = execute_sparql_query(prefixed_query(query_body))
    if not results:
        return None
    return results[0]

def get_user_history_query(userId, limit, skip):
    user_iri = get_user_iri(userId)
    query_body = f'''
    SELECT DISTINCT ?relationshipType ?artist
    WHERE {{
        BIND (IRI("{user_iri}") AS ?user)

    ?user ?relationshipType ?artist .
    ?relationshipNode ex:created ?timestamp .

    FILTER EXISTS {{ ?relationshipNode ex:created ?timestamp }}
    
	  FILTER(?relationshipType = rel:LIKES || ?relationshipType = rel:DISLIKES)
    }}
    ORDER BY ASC(?timestamp)
    '''

    if limit and limit.isdigit():
        query_body += f" LIMIT {limit}"

    if skip and skip.isdigit():
        query_body += f" OFFSET {skip}"

    return query_body

@app.route('/query/user/history', methods=['GET'])
def get_user_history():
    limit = request.args.get('limit')
    skip = request.args.get('skip')
    userId = request.args.get('userId') 
    print("Debug - :", userId, limit, skip)  # Debugging line
    if not userId:
        return jsonify({"error": "Missing 'userId' in request query parameter"}), 400

    query_body = get_user_history_query(userId, limit, skip)
    results = execute_sparql_query(prefixed_query(query_body))
    return update_relationship({"results": results})


# delete like/dislike relationship between user and artist
def delete_user_relationship_query(userId, artistId):
    user_iri = get_user_iri(userId)
    artist_iri = get_artist_iri(artistId)

    query_body = f'''
    DELETE {{
        ?user rel:LIKES ?artist .
        ?user rel:DISLIKES ?artist .
    }}
    WHERE {{
        BIND (IRI("{user_iri}") AS ?user)
        BIND (IRI("{artist_iri}") AS ?artist)
        
        {{
            ?user rel:LIKES ?artist .
        }}
        UNION
        {{
            ?user rel:DISLIKES ?artist .
        }}
    }}
    '''

    return query_body

@app.route('/query/user/delete_relationship', methods=['DELETE'])
def delete_user_relationship():
    # get the userId and artistId from the request body
    userId = request.json.get('userId')
    artistId = request.json.get('artistId')
    if not userId or not artistId:
        return jsonify({"error": "Missing 'userId' or 'artistId' in request body"}), 400

    query_body = delete_user_relationship_query(userId, artistId)
    execute_sparql_query(prefixed_query(query_body), noNeedtoTransform=True)
    return jsonify({"message": "Relationship deleted successfully"})


if __name__ == '__main__':
    app.run(port=5000)