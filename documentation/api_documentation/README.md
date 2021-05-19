# API Documentation/Specification
The API Documentation/Specification is created using Swagger.IO. This tool helps to document API's.

## Generating API from Swagger-YAML File
```bash
cd dwa_quizzer/documentation/api_documentation
npm init
npm run gen-api-doc

// This should have generated a HTML-page (index.html) inside view_doc.
// Open this HTML-page to view the API Specification
```

## Viewing the API Specification
Viewing the API Specification can be done in three ways.
1. This is the simplest way. Open the *view_doc/index.html* page in your browser, contained in the *api_documentation*-directory.
2. Install Swagger-Viewer extension inside Visual Studio Code under the extension tab. Open the *api_doc-swagger.yaml* file and press
*shift-alt-p*
3. Go to [https://editor.swagger.io/](https://editor.swagger.io/) and copy-paste the content from the *api_doc-swagger.yaml* file in the editor.
