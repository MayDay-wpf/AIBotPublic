// jsonSchemaEditor.js

const JsonSchemaEditor = (function () {
    let fieldCounter = 0;

    // 内联 CSS 样式
    const styles = `
        .json-schema-editor {
            font-family: Arial, sans-serif;
            padding: 10px;
        }
        .json-schema-editor button {
            margin: 5px;
            padding: 5px 10px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }
        .json-schema-editor .btn-primary {
            background-color: #007bff;
            color: white;
        }
        .json-schema-editor .btn-success {
            background-color: #28a745;
            color: white;
        }
        .json-schema-editor .btn-danger {
            background-color: #dc3545;
            color: white;
        }
        .json-schema-editor .btn-info {
            background-color: #17a2b8;
            color: white;
        }
        .field-container {
            padding: 3px;
            border-left: 1px solid #ddd;
        }
        .form-row {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        .form-row > div {
            margin-right: 10px;
        }
        .form-row > div:last-child {
            margin-right: 0;
        }
        .form-control {
            width: 100%;
            padding: 5px;
            border: 1px solid #ccc;
            border-radius: 3px;
            height: 30px;
            box-sizing: border-box;
        }
        .nested-fields {
            margin-left: 20px;
        }
        .field-name, .field-type, .field-description {
            flex: 2;
        }
        .field-actions {
            display: flex;
            justify-content: flex-end;
            flex: 1;
        }
        .field-actions button {
            margin-left: 5px;
        }
        .enum-values {
            flex: 2;
            margin-right: 10px;
        }
        .enum-values input {
            width: 100%;
        }
        .schema-options {
            margin-top: 10px;
            padding: 10px;
        }
        .schema-options label {
            margin-right: 10px;
        }
    `;

    function createFieldRow(parentType = 'root', isArrayItem = false) {
        fieldCounter++;
        const fieldId = `field-${fieldCounter}`;
        return `
            <div id="${fieldId}" class="field-container">
                <div class="form-row">
                    <div class="field-name">
                        <input type="text" class="form-control" placeholder="字段名" ${isArrayItem ? 'readonly value="items"' : ''}>
                    </div>
                    <div class="field-type">
                        <select class="form-control">
                            <option value="string">string</option>
                            <option value="number">number</option>
                            <option value="integer">integer</option>
                            <option value="boolean">boolean</option>
                            <option value="array">array</option>
                            <option value="object">object</option>
                            <option value="enum">enum</option>
                        </select>
                    </div>
                    ${!isArrayItem ? `
                    <div class="field-description">
                        <input type="text" class="form-control" placeholder="字段说明">
                    </div>
                    ` : ''}
                    <div class="enum-values" style="display:none;">
                        <input type="text" class="form-control field-enum" placeholder="枚举值,逗号分隔">
                    </div>
                    ${(parentType === 'object' || parentType === 'root') && !isArrayItem ? `
                    <div class="field-required">
                        <label><input type="checkbox" checked> 必填</label>
                    </div>
                    ` : ''}
                    <div class="field-actions">
                        <button class="btn-danger remove-field"><i class="fas fa-minus-circle"></i></button>
                        <button class="btn-info add-nested-field" style="display:none;"><i class="fas fa-plus-circle"></i></button>
                    </div>
                </div>
                <div class="nested-fields"></div>
            </div>
        `;
    }

    function generateSchema(element) {
        let schema = {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: false
        };

        element.find('> .field-container').each(function () {
            const fieldName = $(this).find('> .form-row .field-name input').val();
            const fieldType = $(this).find('> .form-row .field-type select').val();
            const fieldDescription = $(this).find('> .form-row .field-description input').val();
            const fieldEnum = $(this).find('> .form-row .field-enum').val();
            const isRequired = $(this).find('> .form-row .field-required input').is(':checked');

            if (fieldName) {
                schema.properties[fieldName] = {
                    type: fieldType === 'enum' ? 'string' : fieldType,
                    description: fieldDescription || undefined
                };

                if (isRequired) {
                    schema.required.push(fieldName);
                }

                if (fieldType === 'object') {
                    const nestedSchema = generateSchema($(this).find('> .nested-fields'));
                    schema.properties[fieldName].properties = nestedSchema.properties;
                    schema.properties[fieldName].additionalProperties = false;
                    if (nestedSchema.required && nestedSchema.required.length > 0) {
                        schema.properties[fieldName].required = nestedSchema.required;
                    }
                } else if (fieldType === 'array') {
                    const itemsSchema = generateSchema($(this).find('> .nested-fields'));
                    schema.properties[fieldName].items = itemsSchema.properties.items;
                } else if (fieldType === 'enum') {
                    schema.properties[fieldName].enum = fieldEnum.split(',').map(item => item.trim());
                }
            }
        });

        if (schema.required.length === 0) {
            delete schema.required;
        }

        return schema;
    }


    function renderSchema(schema, container, parentType = 'root') {
        for (const [fieldName, fieldData] of Object.entries(schema.properties)) {
            const isArrayItem = parentType === 'array' && fieldName === 'items';
            const fieldRow = $(createFieldRow(parentType, isArrayItem));
            fieldRow.find('.field-name input').val(fieldName);
            fieldRow.find('.field-type select').val(fieldData.type);
            if (!isArrayItem) {
                fieldRow.find('.field-description input').val(fieldData.description);
            }

            if (schema.required && schema.required.includes(fieldName)) {
                fieldRow.find('.field-required input').prop('checked', true);
            } else {
                fieldRow.find('.field-required input').prop('checked', false);
            }

            if (fieldData.enum) {
                fieldRow.find('.field-type select').val('enum');
                fieldRow.find('.enum-values').show();
                fieldRow.find('.field-description').hide();
                fieldRow.find('.field-enum').val(fieldData.enum.join(', '));
            }

            if (fieldData.type === 'object' || fieldData.type === 'array') {
                fieldRow.find('.add-nested-field').show();
            }

            container.append(fieldRow);

            if (fieldData.type === 'object' && fieldData.properties) {
                renderSchema({
                    properties: fieldData.properties,
                    required: fieldData.required
                }, fieldRow.find('.nested-fields'), 'object');
            } else if (fieldData.type === 'array' && fieldData.items) {
                const itemsSchema = {
                    properties: {items: fieldData.items},
                    required: fieldData.required
                };
                renderSchema(itemsSchema, fieldRow.find('.nested-fields'), 'array');
            }
        }
    }


    function initializeEditor(editorContainer) {
        editorContainer.on('click', '.remove-field', function () {
            $(this).closest('.field-container').remove();
        });

        editorContainer.on('click', '.add-nested-field', function () {
            const parentType = $(this).closest('.field-container').find('> .form-row .field-type select').val();
            $(this).closest('.field-container').children('.nested-fields').append(createFieldRow(parentType));
        });

        editorContainer.on('change', '.field-type select', function () {
            const formRow = $(this).closest('.form-row');
            const fieldContainer = $(this).closest('.field-container');
            const enumField = formRow.find('.enum-values');
            const descriptionField = formRow.find('.field-description');
            const addNestedButton = formRow.find('.add-nested-field');
            const nestedFields = fieldContainer.children('.nested-fields');

            if ($(this).val() === 'enum') {
                enumField.show();
                descriptionField.hide();
                addNestedButton.hide();
                nestedFields.empty();
            } else if ($(this).val() === 'object') {
                enumField.hide();
                descriptionField.show();
                addNestedButton.show();
                nestedFields.empty();
            } else if ($(this).val() === 'array') {
                enumField.hide();
                descriptionField.show();
                addNestedButton.hide();
                nestedFields.empty();
                const itemsRow = $(createFieldRow('array', true));
                nestedFields.append(itemsRow);
            } else {
                enumField.hide();
                descriptionField.show();
                addNestedButton.hide();
                nestedFields.empty();
            }
        });
    }

    return {
        create: function (container, options) {
            const existingSchema = options.schema || '';
            const onSave = options.onSave || function () {
            };

            // 添加样式
            if (!document.getElementById('json-schema-editor-styles')) {
                const styleElement = document.createElement('style');
                styleElement.id = 'json-schema-editor-styles';
                styleElement.textContent = styles;
                document.head.appendChild(styleElement);
            }

            const editorContent = $(`
                <div class="json-schema-editor">
                    <div id="schema-editor"></div>
                    <button id="add-field" class="btn-primary">添加字段</button>
                    <button id="save-schema" class="btn-success">保存</button>
                </div>
            `);

            container.empty().append(editorContent);
            const editorContainer = container.find('#schema-editor');

            if (existingSchema) {
                try {
                    const schema = JSON.parse(existingSchema);
                    renderSchema(schema, editorContainer, 'root');
                } catch (e) {
                    console.error('Invalid JSON:', e);
                }
            }

            initializeEditor(editorContainer);

            container.find('#add-field').click(function () {
                editorContainer.append(createFieldRow('root'));
            });

            container.find('#save-schema').click(function () {
                const schema = generateSchema(editorContainer);
                onSave(JSON.stringify(schema, null, 2));
            });

            return {
                getSchema: function () {
                    const schema = generateSchema(editorContainer);
                    return JSON.stringify(schema, null, 2);
                },
                setSchema: function (schemaString) {
                    try {
                        const schema = JSON.parse(schemaString);
                        editorContainer.empty();
                        renderSchema(schema, editorContainer, 'root');
                    } catch (e) {
                        console.error('Invalid JSON:', e);
                    }
                }
            };
        }
    };
})();
