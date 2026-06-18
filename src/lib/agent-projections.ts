export function projectDatabase(database: any): Record<string, any> {
  return {
    id: database.id,
    name: database.name,
    engine: database.engine,
  };
}

export function projectSchema(schema: string): Record<string, any> {
  return { schema };
}

export function projectTable(table: any): Record<string, any> {
  return {
    id: table.id,
    name: table.name,
    schema: table.schema,
  };
}

export function projectField(field: any): Record<string, any> {
  return {
    id: field.id,
    name: field.name,
    database_type: field.database_type,
    description: field.description || null,
  };
}

export function projectCardSummary(card: any): Record<string, any> {
  return {
    id: card.id,
    name: card.name,
    collection_id: card.collection_id,
  };
}

export function projectCardDetail(card: any): Record<string, any> {
  const params = (card.parameters || []).map((parameter: any) => ({
    slug: parameter.slug,
    name: parameter.name,
    type: parameter.type,
  }));
  const templateTags = Object.entries(
    card.dataset_query?.native?.["template-tags"] || {},
  ).map(([key, tag]: [string, any]) => ({
    name: key,
    display_name: tag["display-name"],
    type: tag.type,
    widget_type: tag["widget-type"] || null,
  }));

  return {
    id: card.id,
    name: card.name,
    description: card.description,
    query_type: card.dataset_query?.type,
    query: card.dataset_query?.native?.query || card.dataset_query,
    parameters: params,
    template_tags: templateTags,
  };
}

export function projectCollectionSummary(collection: any): Record<string, any> {
  return {
    id: collection.id,
    name: collection.name,
    location: collection.location,
  };
}

export function projectCollectionItem(item: any): Record<string, any> {
  return {
    id: item.id,
    name: item.name,
    model: item.model,
  };
}

export function projectSearchResult(result: any): Record<string, any> {
  return {
    id: result.id,
    name: result.name,
    model: result.model,
    collection_id: result.collection_id,
  };
}
