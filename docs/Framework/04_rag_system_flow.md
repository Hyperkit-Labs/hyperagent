# RAG System Flow Diagram

## Diagram

```mermaid
flowchart TD
    START[User Query<br/>"Create ERC20 token with burn function"]
    
    subgraph "Stage 1: Embedding Generation"
        LLM1[LLM Provider<br/>Gemini API]
        EMB[Embedding Vector<br/>1536 dimensions<br/>Timeout: 10s]
        START --> LLM1
        LLM1 --> EMB
    end

    subgraph "Stage 2: Vector Search"
        TR[TemplateRetriever<br/>retrieve_templates]
        PG[(PostgreSQL<br/>pgvector Extension)]
        QUERY[Vector Similarity Query<br/>SELECT id, name, code, embedding<br/>FROM contract_templates<br/>WHERE embedding <-> query_embedding < 0.3<br/>ORDER BY embedding <-> query_embedding<br/>LIMIT 5]
        EMB --> TR
        TR --> QUERY
        QUERY --> PG
        PG -->|Top 3 templates| TR
    end

    subgraph "Stage 3: Similarity Calculation"
        SIM[Similarity Scores<br/>Template 1: ERC20 Basic - 0.89 ✓<br/>Template 2: ERC20 Burnable - 0.85 ✓<br/>Template 3: ERC721 Basic - 0.42 ✗]
        THRESH[Threshold: > 0.7]
        TR --> SIM
        SIM --> THRESH
        THRESH -->|Filtered| TEMPLATES[Retrieved Templates<br/>ERC20 Basic<br/>ERC20 Burnable]
    end

    subgraph "Stage 4: Prompt Construction"
        PROMPT[RAG Prompt Builder<br/>System: "You are a Solidity expert..."<br/>Context Templates:<br/>[Template 1 code]<br/>[Template 2 code]<br/>User Request:<br/>"Create ERC20 token with burn function"<br/>Instructions:<br/>- Use templates as reference<br/>- Generate optimized code<br/>- Include burn functionality]
        TEMPLATES --> PROMPT
    end

    subgraph "Stage 5: LLM Generation"
        LLM2[LLM Provider<br/>Gemini API<br/>Model: gemini-2.5-flash]
        GEN[Generated Contract Code<br/>Timeout: 30s]
        PROMPT --> LLM2
        LLM2 --> GEN
    end

    subgraph "Stage 6: Code Extraction"
        EXTRACT[Code Extractor<br/>Extract from markdown code blocks]
        SOLIDITY[Solidity Code<br/>pragma solidity ^0.8.0;<br/>...]
        GEN --> EXTRACT
        EXTRACT --> SOLIDITY
    end

    subgraph "Stage 7: Validation"
        VAL[Contract Validator]
        CHECKS[Checks:<br/>✓ Contains pragma statement<br/>✓ Valid Solidity syntax<br/>✓ Has contract keyword<br/>✓ Constructor present]
        SOLIDITY --> VAL
        VAL --> CHECKS
    end

    subgraph "Stage 8: Storage"
        STORE1[(PostgreSQL<br/>generated_contracts table<br/>code, abi, workflow_id)]
        STORE2[IPFS/Pinata<br/>Template Storage<br/>Optional]
        CHECKS --> STORE1
        CHECKS --> STORE2
    end

    END[Contract Ready<br/>Stored in Database]

    STORE1 --> END
    STORE2 --> END

    style START fill:#e1f5ff
    style LLM1 fill:#f0e6ff
    style EMB fill:#e6ccff
    style TR fill:#d4edda
    style PG fill:#cfe2ff
    style QUERY fill:#fff3cd
    style SIM fill:#ffeaa7
    style TEMPLATES fill:#fff3cd
    style PROMPT fill:#ffe6cc
    style LLM2 fill:#f0e6ff
    style GEN fill:#d4edda
    style EXTRACT fill:#d1ecf1
    style SOLIDITY fill:#cfe2ff
    style VAL fill:#f8d7da
    style CHECKS fill:#fff3cd
    style STORE1 fill:#cfe2ff
    style STORE2 fill:#ffe6cc
    style END fill:#d4edda
```

## RAG Pipeline Steps

### 1. Embedding Generation
- **Input**: User query string
- **Process**: LLM Provider `embed()` method
- **Output**: 1536-dimensional vector
- **Timeout**: 10 seconds
- **Model**: Gemini embedding model

### 2. Vector Search
- **Database**: PostgreSQL with pgvector extension
- **Query**: Cosine similarity search
- **Formula**: `1 - cosine_distance(embedding1, embedding2)`
- **Threshold**: Similarity > 0.7
- **Limit**: Top 5 templates

### 3. Template Retrieval
- **Source**: `contract_templates` table
- **Fields**: id, name, code, embedding, description, tags
- **Filtering**: By similarity score and contract_type
- **Output**: List of similar templates with metadata

### 4. Prompt Construction
- **System Prompt**: Instructions for Solidity expert
- **Context**: Retrieved template code snippets
- **User Request**: Original NLP description
- **Instructions**: Specific requirements (burn function, etc.)

### 5. LLM Generation
- **Model**: gemini-2.5-flash (or gemini-2.5-flash-lite)
- **Input**: Enhanced prompt with RAG context
- **Output**: Generated Solidity code (may include markdown)
- **Timeout**: 30 seconds

### 6. Code Extraction
- **Process**: Extract Solidity code from markdown code blocks
- **Pattern**: Remove ```solidity and ``` markers
- **Output**: Clean Solidity source code

### 7. Validation
- **Checks**:
  - Contains `pragma solidity` statement
  - Valid Solidity syntax
  - Has `contract` keyword
  - Constructor present (if needed)
- **On Failure**: Return validation errors

### 8. Storage
- **PostgreSQL**: Store in `generated_contracts` table
- **IPFS/Pinata**: Optional template storage for future RAG

## Performance Metrics

- **Embedding Generation**: < 10s
- **Vector Search**: < 50ms (with pgvector index)
- **Template Retrieval**: < 100ms
- **LLM Generation**: < 30s
- **Total RAG Pipeline**: < 15s (typical)

## Database Schema

```sql
CREATE TABLE contract_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contract_type VARCHAR(100),
    code TEXT NOT NULL,
    embedding vector(1536),  -- pgvector
    description TEXT,
    tags TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON contract_templates 
    USING ivfflat (embedding vector_cosine_ops);
```

## Benefits

- **Better Code Quality**: Templates provide proven patterns
- **Consistency**: Follows established contract structures
- **Reduced Errors**: Template-based generation is more reliable
- **Context-Aware**: LLM has relevant examples
- **Scalable**: Vector search is fast even with thousands of templates

