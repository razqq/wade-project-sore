import pandas as pd
from rdflib import Graph, URIRef, Literal, Namespace, XSD

# Load the CSV file
df = pd.read_csv('export2.csv')

# Create a new RDF graph
g = Graph()

# Iterate over the rows of the DataFrame and convert CSV data to RDF
for index, row in df.iterrows():
    subject = URIRef(row['subject'].strip('"'))
    predicate = URIRef(str(row['predicate']).strip('"'))
    obj = str(row['object']).strip('"')

    # Check if the object is a literal or another resource
    if row['isLiteral']:
        # Convert to a literal with a datatype if provided
        datatype = URIRef(row['literalType'].strip('"')) if pd.notnull(row['literalType']) else None
        literal_lang = row['literalLang']
        if pd.notnull(datatype):
            g.add((subject, predicate, Literal(obj, datatype=datatype)))
        elif pd.notnull(literal_lang):
            g.add((subject, predicate, Literal(obj, lang=literal_lang)))
        else:
            g.add((subject, predicate, Literal(obj)))
    else:
        g.add((subject, predicate, URIRef(obj)))

# Serialize the graph to Turtle format
turtle_data = g.serialize(format='turtle')

# Save the Turtle data to a file
output_file_path = 'output3.ttl'
with open(output_file_path, 'w') as f:
    f.write(turtle_data)
